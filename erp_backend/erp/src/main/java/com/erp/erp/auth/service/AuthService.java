package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.RefreshTokenRequest;
import com.erp.erp.auth.dto.SignupAvailabilityResponse;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.SignupResponse;
import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.auth.dto.TokenPairResponse;
import com.erp.erp.auth.dto.UserResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.config.JwtService;
import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import com.erp.erp.kyc.repository.SignupDocumentRepository;
import com.erp.erp.kyc.service.KycStorageService;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuthService {

    /** Same reserved list as the Angular TenantService. */
    private static final Set<String> RESERVED_SUBDOMAINS =
            Set.of("admin", "api", "www", "app", "login", "signup", "dashboard");

    private static final String SIGNUP_TRIAL_MESSAGE =
            "Trial account created with 30 free connections.";

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final SignupDocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final KycStorageService storageService;
    private final SignupOtpService signupOtpService;

    public AuthService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            SignupDocumentRepository documentRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokenService,
            KycStorageService storageService,
            SignupOtpService signupOtpService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.documentRepository = documentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.storageService = storageService;
        this.signupOtpService = signupOtpService;
    }

    @Transactional
    public TokenPairResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() -> unauthorized());

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw unauthorized();
        }

        if (!user.isActive()) {
            throw new AuthException(403, "account disabled");
        }
        if (user.getTenant() != null
                && user.getTenant().getTenantStatus() == TenantStatus.SUSPENDED) {
            throw new AuthException(403, "account suspended");
        }

        consumeTrial(user);

        return tokenPair(user, refreshTokenService.create(user));
    }

    /** Rotates the refresh token and returns a fresh access token. */
    @Transactional
    public TokenPairResponse refresh(RefreshTokenRequest request) {
        RefreshTokenService.Rotation rotation = refreshTokenService.rotate(request.refreshToken());
        return tokenPair(rotation.user(), rotation.refreshToken());
    }

    /** Revokes the refresh token; safe to call more than once. */
    public void logout(RefreshTokenRequest request) {
        refreshTokenService.revoke(request.refreshToken());
    }

    /** Public pre-check used by the Angular signup wizard. */
    @Transactional(readOnly = true)
    public SignupAvailabilityResponse signupAvailability(String subdomain) {
        String normalized = subdomain == null ? "" : subdomain.trim().toLowerCase(Locale.ROOT);
        boolean validFormat = normalized.matches("^[a-z0-9-]{3,}$");
        boolean available = validFormat
                && !RESERVED_SUBDOMAINS.contains(normalized)
                && !tenantRepository.existsBySubdomain(normalized);
        return new SignupAvailabilityResponse(available);
    }

    @Transactional
    public SignupResponse signup(SignupRequest request, Map<DocumentSlot, MultipartFile> documents) {
        String email = request.email().trim().toLowerCase();
        String subdomain = request.subdomain().trim().toLowerCase();
        String planId = PlanResolver.resolve(request.planId(), request.modules());

        if (userRepository.existsByEmail(email)) {
            throw new AuthException(400, "email already in use");
        }
        if (RESERVED_SUBDOMAINS.contains(subdomain)) {
            throw new AuthException(400, "subdomain not available");
        }
        if (tenantRepository.existsBySubdomain(subdomain)) {
            throw new AuthException(400, "subdomain not available");
        }
        signupOtpService.requireVerified(email, request.verificationToken());

        // Check every document before writing anything to disk.
        for (DocumentSlot slot : DocumentSlot.values()) {
            MultipartFile file = documents.get(slot);
            if (file == null || file.isEmpty()) {
                throw new AuthException(400, slot.getKey() + ": required file is missing");
            }
        }

        Tenant tenant = new Tenant();
        tenant.setCompanyName(request.companyName().trim());
        tenant.setEmail(email);
        tenant.setSubdomain(subdomain);
        tenant.setCountry(request.country().trim());
        tenant.setLanguage(request.language().trim());
        tenant.setCompanySize(request.companySize().trim());
        tenant.setPlanId(planId);
        tenant.setModuleList(request.modules());
        tenant.setTaxId(request.taxId().trim());
        tenant.setKycStatus(KycStatus.PENDING);
        tenant.setBillingStatus(BillingStatus.NONE);
        tenant.setTenantStatus(TenantStatus.TRIAL);
        tenant.setTrialLimit(30);
        tenant.setTrialUsed(0);
        tenant.setTrialStartedAt(Instant.now());
        tenant.setBillingInterval(
                BillingInterval.valueOf(request.billingInterval().trim().toUpperCase(Locale.ROOT)));
        tenant = tenantRepository.save(tenant);

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setTenant(tenant);
        user = userRepository.save(user);

        storeDocuments(tenant, user, documents);

        signupOtpService.clear(email);
        return new SignupResponse(SIGNUP_TRIAL_MESSAGE, null);
    }

    /** Used by GET /api/v1/auth/me — loads the user behind the JWT subject. */
    @Transactional(readOnly = true)
    public AuthResponse me(String email) {
        User user = userRepository
                .findByEmail(email.trim().toLowerCase())
                .orElseThrow(() -> unauthorized());
        return buildResponse(user);
    }

    /**
     * Validates the four files, writes them using a generated file id, then
     * inserts the rows with their storage paths. If anything fails, files
     * already written are removed.
     */
    private void storeDocuments(
            Tenant tenant, User user, Map<DocumentSlot, MultipartFile> documents) {
        for (DocumentSlot slot : DocumentSlot.values()) {
            storageService.validate(documents.get(slot), slot);
        }

        List<SignupDocument> toSave = new ArrayList<>();
        for (DocumentSlot slot : DocumentSlot.values()) {
            MultipartFile file = documents.get(slot);
            String originalName = file.getOriginalFilename();
            if (originalName == null || originalName.isBlank()) {
                originalName = slot.getKey();
            }

            SignupDocument document = new SignupDocument();
            document.setTenant(tenant);
            document.setSlot(slot);
            document.setOriginalFileName(originalName);
            document.setContentType(file.getContentType().toLowerCase(Locale.ROOT));
            document.setSizeBytes(file.getSize());
            toSave.add(document);
        }

        List<String> storedPaths = new ArrayList<>();
        try {
            for (SignupDocument document : toSave) {
                UUID fileId = UUID.randomUUID();
                KycStorageService.StoredFile stored = storageService.store(
                        documents.get(document.getSlot()),
                        tenant.getId(),
                        user.getId(),
                        fileId,
                        document.getSlot());
                storedPaths.add(stored.storagePath());
                document.setStoragePath(stored.storagePath());
            }
            documentRepository.saveAllAndFlush(toSave);
        } catch (RuntimeException ex) {
            storedPaths.forEach(storageService::deleteQuietly);
            throw ex;
        }
    }

    private void consumeTrial(User user) {
        if (user.getTenant() == null
                || user.getTenant().getTenantStatus() != TenantStatus.TRIAL) {
            return;
        }

        Tenant tenant = tenantRepository
                .findByIdForUpdate(user.getTenant().getId())
                .orElseThrow(() -> new AuthException(404, "tenant not found"));

        if (tenant.getTrialUsed() >= tenant.getTrialLimit()) {
            throw new AuthException(403, "trial limit reached; subscribe to continue");
        }

        tenant.setTrialUsed(tenant.getTrialUsed() + 1);
        if (tenant.getTrialUsed() >= tenant.getTrialLimit()) {
            tenant.setTrialEndedAt(Instant.now());
        }
        user.setTenant(tenant);
    }

    private TokenPairResponse tokenPair(User user, String refreshToken) {
        return new TokenPairResponse(
                jwtService.generateToken(user),
                refreshToken,
                "Bearer",
                jwtService.getExpirationSeconds());
    }

    private AuthResponse buildResponse(User user) {
        UserResponse userResponse = new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().getCode(),
                user.isMustRenewPassword());

        TenantResponse tenantResponse = user.getTenant() == null ? null : TenantResponse.from(user.getTenant());

        return new AuthResponse(jwtService.generateToken(user), "Bearer", userResponse, tenantResponse);
    }

    /** Same message whether the email exists or the password is wrong. */
    private AuthException unauthorized() {
        return new AuthException(401, "invalid email or password");
    }
}

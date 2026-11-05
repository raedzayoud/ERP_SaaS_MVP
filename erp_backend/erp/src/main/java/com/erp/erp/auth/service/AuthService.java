package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.LoginResponse;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.SignupResponse;
import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.auth.dto.UserResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.billing.service.BillingService;
import com.erp.erp.config.JwtService;
import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import com.erp.erp.kyc.repository.SignupDocumentRepository;
import com.erp.erp.kyc.service.KycStorageService;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
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

    private static final String SIGNUP_PENDING_MESSAGE =
            "Account created. Complete the Stripe payment, then wait for administrator approval.";

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final SignupDocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final KycStorageService storageService;
    private final BillingService billingService;

    public AuthService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            SignupDocumentRepository documentRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            KycStorageService storageService,
            BillingService billingService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.documentRepository = documentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.storageService = storageService;
        this.billingService = billingService;
    }

    @Transactional(readOnly = true)
    public LoginResponse login(LoginRequest request) {
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

        return new LoginResponse(jwtService.generateToken(user));
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
        tenant = tenantRepository.save(tenant);

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setTenant(tenant);
        user = userRepository.save(user);

        List<String> storedPaths = storeDocuments(tenant, user, documents);

        try {
            BillingUrlResponse checkout =
                    billingService.checkout(tenant.getId(), request.billingInterval());
            return new SignupResponse(SIGNUP_PENDING_MESSAGE, checkout.url());
        } catch (RuntimeException ex) {
            storedPaths.forEach(storageService::deleteQuietly);
            billingService.deleteCustomerQuietly(tenant.getStripeCustomerId());
            throw ex;
        }
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
    private List<String> storeDocuments(
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

        return storedPaths;
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

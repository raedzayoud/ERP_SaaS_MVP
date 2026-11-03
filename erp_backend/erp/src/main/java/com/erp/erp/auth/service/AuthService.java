package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.auth.dto.UserResponse;
import com.erp.erp.auth.exception.AuthException;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuthService {

    /** Same reserved list as the Angular TenantService. */
    private static final Set<String> RESERVED_SUBDOMAINS =
            Set.of("admin", "api", "www", "app", "login", "signup", "dashboard");

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final SignupDocumentRepository documentRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final KycStorageService storageService;

    public AuthService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            SignupDocumentRepository documentRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            KycStorageService storageService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.documentRepository = documentRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
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

        return buildResponse(user);
    }

    @Transactional
    public AuthResponse signup(SignupRequest request, Map<DocumentSlot, MultipartFile> documents) {
        String email = request.email().trim().toLowerCase();
        String subdomain = request.subdomain().trim().toLowerCase();

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
        tenant.setPlanId(PlanResolver.resolve(request.modules()));
        tenant.setModuleList(request.modules());
        tenant.setTaxId(request.taxId().trim());
        tenant.setKycStatus(KycStatus.PENDING);
        tenant = tenantRepository.save(tenant);

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setTenant(tenant);
        user = userRepository.save(user);

        storeDocuments(tenant, user, documents);

        return buildResponse(user);
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
     * Validates the four files, saves their DB rows to get UUID ids, then writes
     * {tenantId}/{userId}/{documentId}.{ext}. If a write fails, the files
     * already written are removed and the transaction rolls the rows back.
     */
    private void storeDocuments(Tenant tenant, User user, Map<DocumentSlot, MultipartFile> documents) {
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
        documentRepository.saveAllAndFlush(toSave);

        List<String> storedPaths = new ArrayList<>();
        try {
            for (SignupDocument document : toSave) {
                KycStorageService.StoredFile stored = storageService.store(
                        documents.get(document.getSlot()),
                        tenant.getId(),
                        user.getId(),
                        document.getId(),
                        document.getSlot());
                storedPaths.add(stored.storagePath());
                document.setStoragePath(stored.storagePath());
            }
            documentRepository.saveAll(toSave);
        } catch (RuntimeException ex) {
            storedPaths.forEach(storageService::deleteQuietly);
            throw ex;
        }
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

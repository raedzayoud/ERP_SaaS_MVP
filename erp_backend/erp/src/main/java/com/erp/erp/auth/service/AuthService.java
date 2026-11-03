package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.auth.dto.UserResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import java.util.Set;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    /** Same reserved list as the Angular TenantService. */
    private static final Set<String> RESERVED_SUBDOMAINS =
            Set.of("admin", "api", "www", "app", "login", "signup", "dashboard");

    private final UserRepository userRepository;
    private final TenantRepository tenantRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(
            UserRepository userRepository,
            TenantRepository tenantRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.userRepository = userRepository;
        this.tenantRepository = tenantRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String email = request.email().trim().toLowerCase();

        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() -> unauthorized());

        if (!user.isActive()) {
            throw new AuthException(403, "account disabled");
        }

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw unauthorized();
        }

        return buildResponse(user);
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
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

        Tenant tenant = new Tenant();
        tenant.setCompanyName(request.companyName().trim());
        tenant.setEmail(email);
        tenant.setSubdomain(subdomain);
        tenant.setCountry(request.country().trim());
        tenant.setLanguage(request.language().trim());
        tenant.setCompanySize(request.companySize().trim());
        tenant.setPlanId("starter");
        tenant.setModuleList(request.modules());
        tenant = tenantRepository.save(tenant);

        User user = new User();
        user.setFullName(request.fullName().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setTenant(tenant);
        user = userRepository.save(user);

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

    private AuthResponse buildResponse(User user) {
        UserResponse userResponse = new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().getCode(),
                user.isMustRenewPassword());

        TenantResponse tenantResponse = user.getTenant() == null ? null : toTenantResponse(user.getTenant());

        return new AuthResponse(jwtService.generateToken(user), "Bearer", userResponse, tenantResponse);
    }

    private TenantResponse toTenantResponse(Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getCompanyName(),
                tenant.getEmail(),
                tenant.getSubdomain(),
                tenant.getCountry(),
                tenant.getLanguage(),
                tenant.getCompanySize(),
                tenant.getPlanId(),
                tenant.getModuleList(),
                tenant.getCurrency(),
                tenant.getTaxId(),
                tenant.getAddress(),
                tenant.getCreatedAt() == null ? null : tenant.getCreatedAt().toString());
    }

    /** Same message whether the email exists or the password is wrong. */
    private AuthException unauthorized() {
        return new AuthException(401, "invalid email or password");
    }
}

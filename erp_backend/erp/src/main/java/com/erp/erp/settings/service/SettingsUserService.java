package com.erp.erp.settings.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.settings.dto.CreateTeamMemberRequest;
import com.erp.erp.settings.dto.TeamMemberResponse;
import com.erp.erp.settings.dto.UpdateTeamMemberRequest;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lists and manages the users of one workspace only. */
@Service
public class SettingsUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TeamMemberMailService mailService;

    public SettingsUserService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            TeamMemberMailService mailService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
    }

    @Transactional(readOnly = true)
    public List<TeamMemberResponse> list(Tenant tenant) {
        return userRepository.findByTenantIdOrderByFullNameAsc(tenant.getId()).stream()
                .map(TeamMemberResponse::from)
                .toList();
    }

    @Transactional
    public TeamMemberResponse create(Tenant tenant, CreateTeamMemberRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (userRepository.existsByEmail(email)) {
            throw new AuthException(409, "email already in use");
        }
        if (userRepository.countByTenantId(tenant.getId()) >= PlanLimits.maxUsers(tenant.getPlanId())) {
            throw new AuthException(409, "plan user limit reached");
        }

        User user = new User();
        user.setFullName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setRole(assignableRole(request.role()));
        user.setActive(true);
        user.setMustRenewPassword(request.mustRenewPassword());
        user.setTenant(tenant);

        User saved = userRepository.save(user);

        try {
            mailService.sendCredentials(
                    email, request.password(), tenant.getCompanyName());
        } catch (MailException ex) {
            // The transaction is rolled back: no member without known credentials.
            throw new AuthException(502, "could not send the credentials email");
        }

        return TeamMemberResponse.from(saved);
    }

    @Transactional
    public TeamMemberResponse update(Tenant tenant, UUID userId, UpdateTeamMemberRequest request) {
        User user = find(tenant, userId);

        if (request.role() != null) {
            Role role = assignableRole(request.role());
            if (user.getRole() == Role.ADMIN_ENTREPRISE && role != Role.ADMIN_ENTREPRISE) {
                guardLastAdmin(tenant);
            }
            user.setRole(role);
        }
        if (request.active() != null) {
            if (!request.active() && user.getRole() == Role.ADMIN_ENTREPRISE) {
                guardLastAdmin(tenant);
            }
            user.setActive(request.active());
        }
        if (request.mustRenewPassword() != null) {
            user.setMustRenewPassword(request.mustRenewPassword());
        }

        return TeamMemberResponse.from(userRepository.save(user));
    }

    @Transactional
    public void delete(Tenant tenant, UUID userId) {
        User user = find(tenant, userId);
        if (user.getRole() == Role.ADMIN_ENTREPRISE) {
            guardLastAdmin(tenant);
        }
        if (userRepository.countByTenantId(tenant.getId()) <= 1) {
            throw new AuthException(409, "cannot remove the last user");
        }
        userRepository.delete(user);
    }

    private User find(Tenant tenant, UUID userId) {
        return userRepository
                .findByIdAndTenantId(userId, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "user not found"));
    }

    private void guardLastAdmin(Tenant tenant) {
        if (userRepository.countByTenantIdAndRole(tenant.getId(), Role.ADMIN_ENTREPRISE) <= 1) {
            throw new AuthException(409, "cannot remove or demote the last administrator");
        }
    }

    private Role assignableRole(String value) {
        if (value == null) {
            throw new AuthException(400, "invalid role");
        }
        Role role;
        try {
            role = Role.fromCode(value.trim().toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid role");
        }
        if (role == Role.SUPER_ADMIN) {
            throw new AuthException(400, "role cannot be assigned");
        }
        return role;
    }
}

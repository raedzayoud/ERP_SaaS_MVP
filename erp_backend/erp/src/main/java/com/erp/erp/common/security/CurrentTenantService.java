package com.erp.erp.common.security;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.Map;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

/** Resolves the workspace of the authenticated user and checks module access. */
@Service
public class CurrentTenantService {

    private final UserRepository userRepository;

    public CurrentTenantService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public Tenant require(Jwt jwt) {
        String email = jwt == null ? null : jwt.getSubject();
        if (email == null || email.isBlank()) {
            throw new AuthException(401, "not authenticated");
        }

        User user = userRepository
                .findByEmail(email)
                .orElseThrow(() -> new AuthException(401, "user not found"));

        if (user.getTenant() == null) {
            throw new AuthException(403, "no workspace");
        }
        return user.getTenant();
    }

    public void requireModule(Jwt jwt, Tenant tenant, String moduleId) {
        if (!tenant.getModuleList().contains(moduleId)) {
            throw new AuthException(403, "module not enabled");
        }

        Object permissions = jwt == null ? null : jwt.getClaim("permissions");
        if (!(permissions instanceof Map<?, ?> map) || !map.containsKey(moduleId)) {
            throw new AuthException(403, "module access denied");
        }
    }
}

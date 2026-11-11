package com.erp.erp.settings.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.tenant.model.Tenant;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

/** Settings are reserved to the workspace administrator. */
@Service
public class SettingsAccess {

    private final CurrentTenantService currentTenantService;

    public SettingsAccess(CurrentTenantService currentTenantService) {
        this.currentTenantService = currentTenantService;
    }

    public Tenant requireAdmin(Jwt jwt) {
        Tenant tenant = currentTenantService.require(jwt);
        if (!"admin-entreprise".equals(jwt.getClaimAsString("role"))) {
            throw new AuthException(403, "admin access required");
        }
        return tenant;
    }
}

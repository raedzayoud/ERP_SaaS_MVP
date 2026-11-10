package com.erp.erp.marketing.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.marketing.dto.MarketingDashboardResponse;
import com.erp.erp.marketing.service.MarketingDashboardService;
import com.erp.erp.tenant.model.Tenant;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/marketing")
public class MarketingDashboardController {

    private final MarketingDashboardService service;
    private final CurrentTenantService currentTenant;

    public MarketingDashboardController(
            MarketingDashboardService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping("/dashboard")
    public MarketingDashboardResponse dashboard(@AuthenticationPrincipal Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "marketing");
        return service.dashboard(tenant);
    }
}

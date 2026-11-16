package com.erp.erp.hr.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.hr.dto.HrDashboardResponse;
import com.erp.erp.hr.service.HrDashboardService;
import com.erp.erp.tenant.model.Tenant;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The figures of the HR dashboard. */
@RestController
@RequestMapping("/api/v1/hr/dashboard")
public class HrDashboardController {

    private final HrDashboardService service;
    private final CurrentTenantService currentTenant;

    public HrDashboardController(HrDashboardService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public HrDashboardResponse dashboard(@AuthenticationPrincipal Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "hr");
        return service.dashboard(tenant);
    }
}

package com.erp.erp.admin.controller;

import com.erp.erp.admin.dto.AdminStatsResponse;
import com.erp.erp.admin.dto.AdminTenantResponse;
import com.erp.erp.admin.dto.UpdateTenantStatusRequest;
import com.erp.erp.admin.service.AdminStatsService;
import com.erp.erp.admin.service.AdminTenantService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Super-admin dashboard and tenant management. */
@RestController
@RequestMapping("/api/v1/admin")
public class AdminDashboardController {

    private final AdminStatsService statsService;
    private final AdminTenantService tenantService;

    public AdminDashboardController(
            AdminStatsService statsService, AdminTenantService tenantService) {
        this.statsService = statsService;
        this.tenantService = tenantService;
    }

    @GetMapping("/stats")
    public AdminStatsResponse stats() {
        return statsService.stats();
    }

    @GetMapping("/tenants")
    public List<AdminTenantResponse> tenants() {
        return tenantService.list();
    }

    @PutMapping("/tenants/{tenantId}/status")
    public AdminTenantResponse updateTenantStatus(
            @PathVariable UUID tenantId, @Valid @RequestBody UpdateTenantStatusRequest request) {
        return tenantService.updateStatus(tenantId, request.status());
    }
}

package com.erp.erp.settings.controller;

import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.settings.dto.CompanySettingsRequest;
import com.erp.erp.settings.service.SettingsAccess;
import com.erp.erp.settings.service.SettingsCompanyService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings/company")
public class SettingsCompanyController {

    private final SettingsCompanyService companyService;
    private final SettingsAccess access;

    public SettingsCompanyController(SettingsCompanyService companyService, SettingsAccess access) {
        this.companyService = companyService;
        this.access = access;
    }

    @GetMapping
    public TenantResponse get(@AuthenticationPrincipal Jwt jwt) {
        return companyService.get(access.requireAdmin(jwt));
    }

    @PutMapping
    public TenantResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CompanySettingsRequest request) {
        return companyService.update(access.requireAdmin(jwt), request);
    }
}

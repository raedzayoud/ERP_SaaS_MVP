package com.erp.erp.settings.controller;

import com.erp.erp.settings.dto.AddModulesRequest;
import com.erp.erp.settings.dto.ModuleCatalogResponse;
import com.erp.erp.settings.dto.ModulePurchaseResponse;
import com.erp.erp.settings.service.SettingsAccess;
import com.erp.erp.settings.service.SettingsModuleService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The modules a workspace can buy on top of its plan. */
@RestController
@RequestMapping("/api/v1/settings/modules")
public class SettingsModuleController {

    private final SettingsModuleService moduleService;
    private final SettingsAccess access;

    public SettingsModuleController(
            SettingsModuleService moduleService, SettingsAccess access) {
        this.moduleService = moduleService;
        this.access = access;
    }

    @GetMapping
    public ModuleCatalogResponse catalog(@AuthenticationPrincipal Jwt jwt) {
        return moduleService.catalog(access.requireAdmin(jwt));
    }

    @PostMapping
    public ModulePurchaseResponse addModules(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AddModulesRequest request) {
        Tenant tenant = access.requireAdmin(jwt);
        return moduleService.addModules(tenant, request);
    }
}

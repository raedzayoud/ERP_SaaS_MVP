package com.erp.erp.marketing.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.marketing.dto.CampaignRequest;
import com.erp.erp.marketing.dto.CampaignResponse;
import com.erp.erp.marketing.service.MarketingCampaignService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/marketing/campaigns")
public class MarketingCampaignController {

    private final MarketingCampaignService service;
    private final CurrentTenantService currentTenant;

    public MarketingCampaignController(
            MarketingCampaignService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<CampaignResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active) {
        return service.list(tenant(jwt), search, active);
    }

    @GetMapping("/{id}")
    public CampaignResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<CampaignResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CampaignRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public CampaignResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody CampaignRequest request) {
        return service.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "marketing");
        return tenant;
    }
}

package com.erp.erp.crm.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.crm.dto.OpportunityRequest;
import com.erp.erp.crm.dto.OpportunityResponse;
import com.erp.erp.crm.dto.OpportunityStageRequest;
import com.erp.erp.crm.service.CrmOpportunityService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/crm/opportunities")
public class CrmOpportunityController {

    private final CrmOpportunityService opportunities;
    private final CurrentTenantService currentTenant;

    public CrmOpportunityController(
            CrmOpportunityService opportunities, CurrentTenantService currentTenant) {
        this.opportunities = opportunities;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<OpportunityResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return opportunities.list(tenant(jwt));
    }

    @GetMapping("/{id}")
    public OpportunityResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return opportunities.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<OpportunityResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody OpportunityRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(opportunities.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public OpportunityResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody OpportunityRequest request) {
        return opportunities.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        opportunities.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/stage")
    public OpportunityResponse updateStage(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody OpportunityStageRequest request) {
        return opportunities.updateStage(tenant(jwt), id, request.stage());
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "contacts");
        return tenant;
    }
}

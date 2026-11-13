package com.erp.erp.crm.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.crm.dto.LeadConversionResponse;
import com.erp.erp.crm.dto.LeadRequest;
import com.erp.erp.crm.dto.LeadResponse;
import com.erp.erp.crm.dto.PageResponse;
import com.erp.erp.crm.service.CrmLeadService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/crm/leads")
public class CrmLeadController {

    private final CrmLeadService leads;
    private final CurrentTenantService currentTenant;

    public CrmLeadController(CrmLeadService leads, CurrentTenantService currentTenant) {
        this.leads = leads;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public PageResponse<LeadResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort) {
        return leads.list(tenant(jwt), page, size, search, status, sort);
    }

    @GetMapping("/{id}")
    public LeadResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return leads.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<LeadResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LeadRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(leads.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public LeadResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody LeadRequest request) {
        return leads.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        leads.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/lose")
    public LeadResponse lose(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return leads.lose(tenant(jwt), id);
    }

    @PostMapping("/{id}/convert")
    public LeadConversionResponse convert(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return leads.convert(tenant(jwt), id);
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "contacts");
        return tenant;
    }
}

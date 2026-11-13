package com.erp.erp.crm.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.crm.dto.InteractionRequest;
import com.erp.erp.crm.dto.InteractionResponse;
import com.erp.erp.crm.dto.PageResponse;
import com.erp.erp.crm.dto.PartnerRequest;
import com.erp.erp.crm.dto.PartnerResponse;
import com.erp.erp.crm.service.CrmInteractionService;
import com.erp.erp.crm.service.CrmPartnerService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/crm/partners")
public class CrmPartnerController {

    private final CrmPartnerService partners;
    private final CrmInteractionService interactions;
    private final CurrentTenantService currentTenant;

    public CrmPartnerController(
            CrmPartnerService partners,
            CrmInteractionService interactions,
            CurrentTenantService currentTenant) {
        this.partners = partners;
        this.interactions = interactions;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public PageResponse<PartnerResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String kind,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String sort) {
        return partners.list(tenant(jwt), page, size, search, kind, active, sort);
    }

    @GetMapping("/{id}")
    public PartnerResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return partners.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<PartnerResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PartnerRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(partners.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public PartnerResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PartnerRequest request) {
        return partners.update(tenant(jwt), id, request);
    }

    @PatchMapping("/{id}/archive")
    public PartnerResponse archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return partners.archive(tenant(jwt), id);
    }

    @PatchMapping("/{id}/restore")
    public PartnerResponse restore(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return partners.restore(tenant(jwt), id);
    }

    @GetMapping("/{id}/interactions")
    public List<InteractionResponse> listInteractions(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return interactions.listForPartner(tenant(jwt), id);
    }

    @PostMapping("/{id}/interactions")
    public ResponseEntity<InteractionResponse> addInteraction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody InteractionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(interactions.add(tenant(jwt), id, request));
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "contacts");
        return tenant;
    }
}

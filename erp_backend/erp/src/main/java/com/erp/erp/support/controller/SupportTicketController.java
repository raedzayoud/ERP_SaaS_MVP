package com.erp.erp.support.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.support.dto.InteractionRequest;
import com.erp.erp.support.dto.InteractionResponse;
import com.erp.erp.support.dto.SupportTicketRequest;
import com.erp.erp.support.dto.SupportTicketResponse;
import com.erp.erp.support.service.SupportTicketService;
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
@RequestMapping("/api/v1/support/tickets")
public class SupportTicketController {

    private final SupportTicketService service;
    private final CurrentTenantService currentTenant;

    public SupportTicketController(
            SupportTicketService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<SupportTicketResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String type) {
        Tenant tenant = tenant(jwt);
        return service.list(tenant, search, status, type);
    }

    @GetMapping("/{id}")
    public SupportTicketResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<SupportTicketResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SupportTicketRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public SupportTicketResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody SupportTicketRequest request) {
        return service.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/interactions")
    public List<InteractionResponse> listInteractions(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.listInteractions(tenant(jwt), id);
    }

    @PostMapping("/{id}/interactions")
    public ResponseEntity<InteractionResponse> addInteraction(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody InteractionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.addInteraction(tenant(jwt), id, request));
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "support");
        return tenant;
    }
}

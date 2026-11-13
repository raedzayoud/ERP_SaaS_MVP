package com.erp.erp.crm.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.crm.dto.InteractionRequest;
import com.erp.erp.crm.dto.InteractionResponse;
import com.erp.erp.crm.service.CrmInteractionService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/crm/interactions")
public class CrmInteractionController {

    private final CrmInteractionService interactions;
    private final CurrentTenantService currentTenant;

    public CrmInteractionController(
            CrmInteractionService interactions, CurrentTenantService currentTenant) {
        this.interactions = interactions;
        this.currentTenant = currentTenant;
    }

    @GetMapping("/reminders")
    public List<InteractionResponse> reminders(@AuthenticationPrincipal Jwt jwt) {
        return interactions.pendingReminders(tenant(jwt));
    }

    @PutMapping("/{id}")
    public InteractionResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody InteractionRequest request) {
        return interactions.update(tenant(jwt), id, request);
    }

    @PutMapping("/{id}/reminder-done")
    public InteractionResponse markReminderDone(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return interactions.markReminderDone(tenant(jwt), id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        interactions.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "contacts");
        return tenant;
    }
}

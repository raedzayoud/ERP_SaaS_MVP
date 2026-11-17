package com.erp.erp.purchases.controller;

import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.purchases.dto.PurchaseOrderRequest;
import com.erp.erp.purchases.dto.PurchaseOrderResponse;
import com.erp.erp.purchases.dto.PurchaseReceptionRequest;
import com.erp.erp.purchases.dto.PurchaseSummaryResponse;
import com.erp.erp.purchases.service.PurchaseOrderService;
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
@RequestMapping("/api/v1/purchases")
public class PurchaseOrderController {

    private final PurchaseOrderService purchases;
    private final CurrentTenantService currentTenant;

    public PurchaseOrderController(
            PurchaseOrderService purchases, CurrentTenantService currentTenant) {
        this.purchases = purchases;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public PageResponse<PurchaseOrderResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String sort) {
        return purchases.list(tenant(jwt), page, size, search, status, sort);
    }

    @GetMapping("/summary")
    public PurchaseSummaryResponse summary(@AuthenticationPrincipal Jwt jwt) {
        return purchases.summary(tenant(jwt));
    }

    @GetMapping("/{id}")
    public PurchaseOrderResponse get(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return purchases.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<PurchaseOrderResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PurchaseOrderRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchases.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public PurchaseOrderResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PurchaseOrderRequest request) {
        return purchases.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        purchases.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/confirm")
    public PurchaseOrderResponse confirm(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return purchases.confirm(tenant(jwt), id);
    }

    @PostMapping("/{id}/cancel")
    public PurchaseOrderResponse cancel(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return purchases.cancel(tenant(jwt), id);
    }

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<PurchaseOrderResponse> duplicate(
            @AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchases.duplicate(tenant(jwt), id));
    }

    @PostMapping("/{id}/receptions")
    public ResponseEntity<PurchaseOrderResponse> receive(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PurchaseReceptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchases.receive(tenant(jwt), id, request));
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "purchases");
        return tenant;
    }
}

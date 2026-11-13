package com.erp.erp.stock.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.stock.dto.WarehouseNameRequest;
import com.erp.erp.stock.dto.WarehouseRequest;
import com.erp.erp.stock.dto.WarehouseResponse;
import com.erp.erp.stock.service.StockService;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stock/warehouses")
public class WarehouseController {

    private final StockService stock;
    private final CurrentTenantService currentTenant;

    public WarehouseController(StockService stock, CurrentTenantService currentTenant) {
        this.stock = stock;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<WarehouseResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return stock.listWarehouses(tenant(jwt));
    }

    @PostMapping
    public ResponseEntity<WarehouseResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody WarehouseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stock.createWarehouse(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public WarehouseResponse rename(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody WarehouseNameRequest request) {
        return stock.renameWarehouse(tenant(jwt), id, request);
    }

    @PatchMapping("/{id}/archive")
    public WarehouseResponse archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return stock.archiveWarehouse(tenant(jwt), id);
    }

    @PatchMapping("/{id}/restore")
    public WarehouseResponse restore(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return stock.restoreWarehouse(tenant(jwt), id);
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "stock");
        return tenant;
    }
}

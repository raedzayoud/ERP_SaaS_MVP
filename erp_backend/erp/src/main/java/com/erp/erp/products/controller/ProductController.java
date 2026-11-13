package com.erp.erp.products.controller;

import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.products.dto.ProductRequest;
import com.erp.erp.products.dto.ProductResponse;
import com.erp.erp.products.service.ProductService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
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
@RequestMapping("/api/v1/products")
public class ProductController {

    private final ProductService products;
    private final CurrentTenantService currentTenant;

    public ProductController(ProductService products, CurrentTenantService currentTenant) {
        this.products = products;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public PageResponse<ProductResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) String supplierId) {
        return products.list(
                tenant(jwt), page, size, search, type, category, active, sort, supplierId);
    }

    @GetMapping("/{id}")
    public ProductResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return products.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<ProductResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ProductRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(products.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public ProductResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody ProductRequest request) {
        return products.update(tenant(jwt), id, request);
    }

    @PatchMapping("/{id}/archive")
    public ProductResponse archive(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return products.archive(tenant(jwt), id);
    }

    @PatchMapping("/{id}/restore")
    public ProductResponse restore(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return products.restore(tenant(jwt), id);
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "products");
        return tenant;
    }
}

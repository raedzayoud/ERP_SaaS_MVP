package com.erp.erp.stock.controller;

import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.stock.dto.AvailabilityIssueResponse;
import com.erp.erp.stock.dto.AvailabilityRequest;
import com.erp.erp.stock.dto.MovementRequest;
import com.erp.erp.stock.dto.MovementResponse;
import com.erp.erp.stock.dto.ReceptionRequest;
import com.erp.erp.stock.dto.SalePostingRequest;
import com.erp.erp.stock.dto.StockLevelResponse;
import com.erp.erp.stock.dto.TransferRequest;
import com.erp.erp.stock.dto.WarehouseSummaryResponse;
import com.erp.erp.stock.service.StockService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/stock")
public class StockController {

    private final StockService stock;
    private final CurrentTenantService currentTenant;

    public StockController(StockService stock, CurrentTenantService currentTenant) {
        this.stock = stock;
        this.currentTenant = currentTenant;
    }

    @GetMapping("/levels")
    public List<StockLevelResponse> levels(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String search) {
        return stock.levels(tenant(jwt), warehouseId, search);
    }

    @GetMapping("/low-stock")
    public List<StockLevelResponse> lowStock(@AuthenticationPrincipal Jwt jwt) {
        return stock.lowStock(tenant(jwt));
    }

    @GetMapping("/summaries")
    public List<WarehouseSummaryResponse> summaries(@AuthenticationPrincipal Jwt jwt) {
        return stock.summaries(tenant(jwt));
    }

    @GetMapping("/movements")
    public PageResponse<MovementResponse> movements(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String warehouseId,
            @RequestParam(required = false) String sort) {
        return stock.movements(tenant(jwt), page, size, search, type, warehouseId, sort);
    }

    @PostMapping("/adjustments")
    public ResponseEntity<MovementResponse> adjustment(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody MovementRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stock.adjustment(tenant(jwt), request));
    }

    @PostMapping("/transfers")
    public ResponseEntity<List<MovementResponse>> transfer(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody TransferRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stock.transfer(tenant(jwt), request));
    }

    @PostMapping("/availability")
    public List<AvailabilityIssueResponse> availability(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody AvailabilityRequest request) {
        return stock.availability(tenant(jwt), request);
    }

    @PostMapping("/receptions")
    public ResponseEntity<List<MovementResponse>> reception(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ReceptionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(stock.reception(tenant(jwt), request));
    }

    @PostMapping("/sales-postings")
    public ResponseEntity<List<MovementResponse>> salePosting(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SalePostingRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(stock.salePosting(tenant(jwt), request));
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "stock");
        return tenant;
    }
}

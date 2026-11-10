package com.erp.erp.marketing.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.marketing.dto.PromotionEvaluationRequest;
import com.erp.erp.marketing.dto.PromotionEvaluationResponse;
import com.erp.erp.marketing.dto.PromotionRequest;
import com.erp.erp.marketing.dto.PromotionResponse;
import com.erp.erp.marketing.service.MarketingPromotionService;
import com.erp.erp.marketing.service.PromotionEvaluationService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
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
@RequestMapping("/api/v1/marketing/promotions")
public class MarketingPromotionController {

    private final MarketingPromotionService service;
    private final PromotionEvaluationService evaluation;
    private final CurrentTenantService currentTenant;

    public MarketingPromotionController(
            MarketingPromotionService service,
            PromotionEvaluationService evaluation,
            CurrentTenantService currentTenant) {
        this.service = service;
        this.evaluation = evaluation;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<PromotionResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) UUID campaignId,
            @RequestParam(required = false) UUID segmentId) {
        return service.list(tenant(jwt), search, active, campaignId, segmentId);
    }

    @GetMapping("/eligible")
    public List<PromotionResponse> eligible(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam String customerId,
            @RequestParam(required = false)
                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate date) {
        return evaluation.eligible(tenant(jwt), customerId, date);
    }

    @PostMapping("/evaluate")
    public PromotionEvaluationResponse evaluate(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody PromotionEvaluationRequest request) {
        return evaluation.evaluate(tenant(jwt), request);
    }

    @GetMapping("/{id}")
    public PromotionResponse get(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return service.get(tenant(jwt), id);
    }

    @PostMapping
    public ResponseEntity<PromotionResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PromotionRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public PromotionResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody PromotionRequest request) {
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

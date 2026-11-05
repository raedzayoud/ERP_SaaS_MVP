package com.erp.erp.billing.controller;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingStatusResponse;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.billing.dto.CheckoutSessionRequest;
import com.erp.erp.billing.service.BillingService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    @PostMapping("/checkout-session")
    public BillingUrlResponse checkout(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CheckoutSessionRequest request) {
        return billingService.checkout(tenantId(jwt), request.interval());
    }

    @GetMapping("/subscription")
    public BillingStatusResponse subscription(@AuthenticationPrincipal Jwt jwt) {
        return billingService.subscription(tenantId(jwt));
    }

    @PostMapping("/portal-session")
    public BillingUrlResponse portal(@AuthenticationPrincipal Jwt jwt) {
        return billingService.portal(tenantId(jwt));
    }

    private UUID tenantId(Jwt jwt) {
        String tenantId = jwt.getClaimAsString("tenantId");
        if (tenantId == null || tenantId.isBlank()) {
            throw new AuthException(400, "no tenant for this account");
        }
        try {
            return UUID.fromString(tenantId);
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid tenant");
        }
    }
}

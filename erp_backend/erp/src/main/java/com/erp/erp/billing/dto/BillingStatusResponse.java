package com.erp.erp.billing.dto;

public record BillingStatusResponse(
        String planId,
        String billingStatus,
        String billingInterval,
        String currentPeriodEnd,
        boolean cancelAtPeriodEnd) {}

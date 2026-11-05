package com.erp.erp.billing.dto;

import jakarta.validation.constraints.NotBlank;

/** interval is "MONTHLY" or "ANNUAL". */
public record CheckoutSessionRequest(
        @NotBlank(message = "interval is required") String interval) {}

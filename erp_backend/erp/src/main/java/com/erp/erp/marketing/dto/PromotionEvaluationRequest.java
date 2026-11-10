package com.erp.erp.marketing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PromotionEvaluationRequest(
        @NotBlank String customerId,
        @NotNull @DecimalMin(value = "0.0", message = "subtotal cannot be negative")
                BigDecimal subtotal,
        @NotBlank
                @Pattern(regexp = "[A-Za-z]{3}", message = "currency must be a 3-letter code")
                String currency,
        LocalDate date) {}

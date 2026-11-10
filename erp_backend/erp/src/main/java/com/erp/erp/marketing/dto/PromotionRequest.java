package com.erp.erp.marketing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record PromotionRequest(
        @NotBlank String name,
        String description,
        UUID campaignId,
        @NotNull UUID segmentId,
        @NotBlank String discountType,
        @NotNull @DecimalMin(value = "0.01", message = "discount value must be greater than zero")
                BigDecimal discountValue,
        @DecimalMin(value = "0.0", message = "minimum order cannot be negative")
                BigDecimal minOrderAmount,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        boolean active) {}

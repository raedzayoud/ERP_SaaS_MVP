package com.erp.erp.marketing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;
import java.time.LocalDate;

public record CampaignRequest(
        @NotBlank String name,
        String description,
        @NotBlank String channel,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        @NotNull @DecimalMin(value = "0.0", message = "budget cannot be negative")
                BigDecimal budget,
        @NotBlank
                @Pattern(regexp = "[A-Za-z]{3}", message = "currency must be a 3-letter code")
                String currency,
        boolean active) {}

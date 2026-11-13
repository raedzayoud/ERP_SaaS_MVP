package com.erp.erp.crm.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record OpportunityRequest(
        @NotBlank @Size(min = 2) String name,
        String customerId,
        String stage,
        @NotNull BigDecimal amount,
        @NotNull LocalDate expectedCloseDate,
        String currency,
        String notes) {}

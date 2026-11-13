package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/** A move of one product from a warehouse to another one. */
public record TransferRequest(
        @NotBlank String productId,
        @NotBlank String fromWarehouseId,
        @NotBlank String toWarehouseId,
        @NotNull BigDecimal quantity,
        LocalDate date,
        @NotBlank String reason) {}

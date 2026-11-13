package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/** A manual correction of the stock of one product in one warehouse. */
public record MovementRequest(
        @NotBlank String direction,
        @NotBlank String productId,
        @NotBlank String warehouseId,
        @NotNull BigDecimal quantity,
        LocalDate date,
        @NotBlank String reason) {}

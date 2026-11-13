package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.List;

/** Stock going out for a posted sales invoice. */
public record SalePostingRequest(
        String refId,
        LocalDate date,
        @NotBlank String warehouseId,
        List<StockItemRequest> items) {}

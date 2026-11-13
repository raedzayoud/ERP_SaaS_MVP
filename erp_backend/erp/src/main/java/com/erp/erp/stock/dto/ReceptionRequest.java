package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;
import java.util.List;

/** Stock coming in from a supplier order. */
public record ReceptionRequest(
        String refId,
        LocalDate date,
        @NotBlank String warehouseId,
        String blNumber,
        List<StockItemRequest> items) {}

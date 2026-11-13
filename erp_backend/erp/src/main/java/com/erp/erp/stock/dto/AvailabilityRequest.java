package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

/** Asks whether the requested quantities are available in a warehouse. */
public record AvailabilityRequest(
        @NotBlank String warehouseId, List<StockItemRequest> items) {}

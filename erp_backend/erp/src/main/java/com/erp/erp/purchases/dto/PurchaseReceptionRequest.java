package com.erp.erp.purchases.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** A delivery note received for a confirmed purchase order. */
public record PurchaseReceptionRequest(
        @NotNull LocalDate date,
        String blNumber,
        @NotBlank String warehouseId,
        @NotNull List<Item> items) {

    public record Item(@NotBlank String lineId, @NotNull @DecimalMin(value = "0.001") BigDecimal quantity) {}
}

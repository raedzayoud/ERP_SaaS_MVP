package com.erp.erp.purchases.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** The draft of a purchase order, sent when it is created or updated. */
public record PurchaseOrderRequest(
        @NotBlank String supplierId,
        @NotNull LocalDate orderDate,
        @NotNull LocalDate expectedDate,
        @NotBlank String paymentTerms,
        @NotBlank String currency,
        String notes,
        @NotNull List<Line> lines) {

    public record Line(
            String productId,
            String reference,
            @NotBlank String description,
            String unit,
            @NotNull @DecimalMin(value = "0.001") BigDecimal quantity,
            @NotNull @DecimalMin(value = "0.00") BigDecimal unitCost,
            @DecimalMin(value = "0.00") BigDecimal discountPct,
            @NotNull @DecimalMin(value = "0.00") BigDecimal vatRate) {}
}

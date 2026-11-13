package com.erp.erp.products.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record ProductSupplierRequest(
        @NotBlank String supplierId,
        String supplierRef,
        @NotNull @DecimalMin(value = "0.00") BigDecimal price,
        @NotNull @Min(1) Integer minQty,
        @NotNull @Min(0) Integer delayDays) {}

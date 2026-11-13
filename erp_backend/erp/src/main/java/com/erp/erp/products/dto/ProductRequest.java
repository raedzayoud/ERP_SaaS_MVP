package com.erp.erp.products.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;

public record ProductRequest(
        @NotBlank String type,
        @NotBlank @Size(min = 2) String sku,
        @NotBlank @Size(min = 2) String name,
        String description,
        @NotBlank String category,
        @NotBlank String unit,
        @NotNull @DecimalMin(value = "0.00") BigDecimal salePrice,
        @NotNull @DecimalMin(value = "0.00") BigDecimal purchasePrice,
        @NotNull @DecimalMin(value = "0.00") BigDecimal vatRate,
        @NotNull @DecimalMin(value = "0.000") BigDecimal minStock,
        List<ProductSupplierRequest> suppliers) {}

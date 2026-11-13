package com.erp.erp.products.dto;

import com.erp.erp.products.model.Product;
import com.erp.erp.products.model.ProductSupplier;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public record ProductResponse(
        UUID id,
        String type,
        String sku,
        String name,
        String description,
        String category,
        String unit,
        BigDecimal salePrice,
        BigDecimal purchasePrice,
        BigDecimal vatRate,
        BigDecimal minStock,
        boolean active,
        List<ProductSupplierResponse> suppliers,
        String createdAt,
        String updatedAt) {

    public static ProductResponse from(Product product, List<ProductSupplier> suppliers) {
        return new ProductResponse(
                product.getId(),
                product.getType() == null
                        ? null
                        : product.getType().name().toLowerCase(Locale.ROOT),
                product.getSku(),
                product.getName(),
                product.getDescription(),
                product.getCategory(),
                product.getUnit(),
                product.getSalePrice(),
                product.getPurchasePrice(),
                product.getVatRate(),
                product.getMinStock(),
                product.isActive(),
                suppliers.stream()
                        .map(
                                supplier ->
                                        new ProductSupplierResponse(
                                                supplier.getId(),
                                                supplier.getSupplierId() == null
                                                        ? null
                                                        : supplier.getSupplierId().toString(),
                                                supplier.getSupplierRef(),
                                                supplier.getPrice(),
                                                supplier.getMinQty(),
                                                supplier.getDelayDays()))
                        .toList(),
                product.getCreatedAt() == null ? null : product.getCreatedAt().toString(),
                product.getUpdatedAt() == null ? null : product.getUpdatedAt().toString());
    }
}

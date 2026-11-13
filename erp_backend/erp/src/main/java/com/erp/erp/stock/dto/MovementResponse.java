package com.erp.erp.stock.dto;

import com.erp.erp.stock.model.StockMovement;
import com.erp.erp.stock.model.Warehouse;
import com.erp.erp.products.model.Product;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

public record MovementResponse(
        UUID id,
        String type,
        String direction,
        String productId,
        String productName,
        String productSku,
        String warehouseId,
        String warehouseName,
        BigDecimal quantity,
        String date,
        String reason,
        String refId,
        String createdAt) {

    public static MovementResponse from(
            StockMovement movement, Product product, Warehouse warehouse) {
        return new MovementResponse(
                movement.getId(),
                movement.getType() == null
                        ? null
                        : movement.getType().name().toLowerCase(Locale.ROOT),
                movement.getDirection() == null
                        ? null
                        : movement.getDirection().name().toLowerCase(Locale.ROOT),
                movement.getProductId() == null ? null : movement.getProductId().toString(),
                product == null ? null : product.getName(),
                product == null ? null : product.getSku(),
                movement.getWarehouseId() == null ? null : movement.getWarehouseId().toString(),
                warehouse == null ? null : warehouse.getName(),
                movement.getQuantity(),
                movement.getDate() == null ? null : movement.getDate().toString(),
                movement.getReason(),
                movement.getRefId(),
                movement.getCreatedAt() == null ? null : movement.getCreatedAt().toString());
    }
}

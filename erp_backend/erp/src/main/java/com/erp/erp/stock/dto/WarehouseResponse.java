package com.erp.erp.stock.dto;

import com.erp.erp.stock.model.Warehouse;
import java.util.UUID;

public record WarehouseResponse(
        UUID id,
        String code,
        String name,
        boolean active,
        String createdAt,
        String updatedAt) {

    public static WarehouseResponse from(Warehouse warehouse) {
        return new WarehouseResponse(
                warehouse.getId(),
                warehouse.getCode(),
                warehouse.getName(),
                warehouse.isActive(),
                warehouse.getCreatedAt() == null ? null : warehouse.getCreatedAt().toString(),
                warehouse.getUpdatedAt() == null ? null : warehouse.getUpdatedAt().toString());
    }
}

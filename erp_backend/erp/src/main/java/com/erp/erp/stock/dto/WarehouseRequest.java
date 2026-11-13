package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;

public record WarehouseRequest(@NotBlank String code, @NotBlank String name) {}

package com.erp.erp.stock.dto;

import jakarta.validation.constraints.NotBlank;

/** The code of a warehouse never changes, only its name does. */
public record WarehouseNameRequest(@NotBlank String name) {}

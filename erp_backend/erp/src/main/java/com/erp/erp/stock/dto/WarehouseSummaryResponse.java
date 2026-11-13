package com.erp.erp.stock.dto;

import java.math.BigDecimal;

/** Small stats of one warehouse: how many references it holds and their value. */
public record WarehouseSummaryResponse(String warehouseId, int refs, BigDecimal value) {}

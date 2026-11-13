package com.erp.erp.stock.dto;

import java.math.BigDecimal;

/** One product of the stock list, with the quantity on hand. */
public record StockLevelResponse(
        String productId,
        String sku,
        String name,
        String unit,
        BigDecimal purchasePrice,
        BigDecimal quantity,
        BigDecimal value,
        BigDecimal minStock,
        boolean low) {}

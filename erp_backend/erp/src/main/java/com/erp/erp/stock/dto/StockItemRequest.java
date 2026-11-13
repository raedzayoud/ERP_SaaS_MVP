package com.erp.erp.stock.dto;

import java.math.BigDecimal;

/** Quantity of one product, used by the availability and posting requests. */
public record StockItemRequest(String productId, BigDecimal quantity) {}

package com.erp.erp.stock.dto;

import java.math.BigDecimal;

/** One product that cannot be taken out of the stock. */
public record AvailabilityIssueResponse(String productId, BigDecimal required, BigDecimal available) {}

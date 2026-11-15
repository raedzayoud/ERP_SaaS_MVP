package com.erp.erp.settings.dto;

import java.math.BigDecimal;
import java.util.List;

/** The modules a workspace can buy, with their price and prerequisites. */
public record ModuleOfferResponse(
        String id,
        BigDecimal priceMonthly,
        String currency,
        List<String> dependencies,
        boolean saleable) {}

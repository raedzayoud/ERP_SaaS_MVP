package com.erp.erp.settings.dto;

import java.math.BigDecimal;
import java.util.List;

/** The payment page the customer has to open to unlock the modules. */
public record ModulePurchaseResponse(
        String url, BigDecimal totalMonthly, List<String> modules) {}

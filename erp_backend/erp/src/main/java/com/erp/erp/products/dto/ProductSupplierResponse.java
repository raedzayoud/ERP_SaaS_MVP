package com.erp.erp.products.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record ProductSupplierResponse(
        UUID id,
        String supplierId,
        String supplierRef,
        BigDecimal price,
        int minQty,
        int delayDays) {}

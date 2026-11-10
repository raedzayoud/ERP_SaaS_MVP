package com.erp.erp.admin.dto;

import java.util.UUID;

public record AdminPaymentResponse(
        String id,
        UUID tenantId,
        String period,
        double amount,
        String status,
        String dueDate,
        String invoiceUrl) {}

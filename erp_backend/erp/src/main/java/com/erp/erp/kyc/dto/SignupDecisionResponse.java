package com.erp.erp.kyc.dto;

import java.util.UUID;

public record SignupDecisionResponse(
        UUID tenantId,
        String status,
        String decidedAt,
        String note,
        String message) {}

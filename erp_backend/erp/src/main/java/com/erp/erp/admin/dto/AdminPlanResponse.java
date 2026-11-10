package com.erp.erp.admin.dto;

import java.util.List;

public record AdminPlanResponse(
        String id,
        String name,
        int priceMonthly,
        int priceAnnual,
        int maxUsers,
        int storageGb,
        int aiQuota,
        List<String> modules,
        List<String> features,
        boolean popular) {}

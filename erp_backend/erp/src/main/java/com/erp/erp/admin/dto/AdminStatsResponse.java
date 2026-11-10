package com.erp.erp.admin.dto;

public record AdminStatsResponse(
        long totalTenants,
        long activeTenants,
        long trialTenants,
        long suspendedTenants,
        long totalUsers,
        double monthlyRevenue,
        long pendingSignups,
        double overdueAmount) {}

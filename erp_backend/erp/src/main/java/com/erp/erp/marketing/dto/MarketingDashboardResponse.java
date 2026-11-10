package com.erp.erp.marketing.dto;

import java.math.BigDecimal;

public record MarketingDashboardResponse(
        long activeCampaigns,
        long activePromotions,
        BigDecimal marketingBudget,
        String currency) {}

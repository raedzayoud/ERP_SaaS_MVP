package com.erp.erp.marketing.dto;

import com.erp.erp.marketing.model.MarketingCampaign;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

public record CampaignResponse(
        UUID id,
        String name,
        String description,
        String channel,
        String startDate,
        String endDate,
        BigDecimal budget,
        String currency,
        boolean active,
        String createdAt,
        String updatedAt) {

    public static CampaignResponse from(MarketingCampaign campaign) {
        return new CampaignResponse(
                campaign.getId(),
                campaign.getName(),
                campaign.getDescription(),
                lower(campaign.getChannel()),
                campaign.getStartDate() == null ? null : campaign.getStartDate().toString(),
                campaign.getEndDate() == null ? null : campaign.getEndDate().toString(),
                campaign.getBudget(),
                campaign.getCurrency(),
                campaign.isActive(),
                campaign.getCreatedAt() == null ? null : campaign.getCreatedAt().toString(),
                campaign.getUpdatedAt() == null ? null : campaign.getUpdatedAt().toString());
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}

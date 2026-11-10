package com.erp.erp.marketing.dto;

import com.erp.erp.marketing.model.MarketingPromotion;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

public record PromotionResponse(
        UUID id,
        String name,
        String description,
        UUID campaignId,
        String campaignName,
        UUID segmentId,
        String segmentName,
        String discountType,
        BigDecimal discountValue,
        BigDecimal minOrderAmount,
        String startDate,
        String endDate,
        boolean active,
        String createdAt,
        String updatedAt) {

    public static PromotionResponse from(MarketingPromotion promotion) {
        return new PromotionResponse(
                promotion.getId(),
                promotion.getName(),
                promotion.getDescription(),
                promotion.getCampaign() == null ? null : promotion.getCampaign().getId(),
                promotion.getCampaign() == null ? null : promotion.getCampaign().getName(),
                promotion.getSegment() == null ? null : promotion.getSegment().getId(),
                promotion.getSegment() == null ? null : promotion.getSegment().getName(),
                lower(promotion.getDiscountType()),
                promotion.getDiscountValue(),
                promotion.getMinOrderAmount(),
                promotion.getStartDate() == null ? null : promotion.getStartDate().toString(),
                promotion.getEndDate() == null ? null : promotion.getEndDate().toString(),
                promotion.isActive(),
                promotion.getCreatedAt() == null ? null : promotion.getCreatedAt().toString(),
                promotion.getUpdatedAt() == null ? null : promotion.getUpdatedAt().toString());
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}

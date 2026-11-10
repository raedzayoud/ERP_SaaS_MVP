package com.erp.erp.marketing.dto;

import com.erp.erp.marketing.model.MarketingPromotion;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

public record PromotionEvaluationResponse(
        UUID promotionId,
        String promotionName,
        String discountType,
        BigDecimal discountValue,
        BigDecimal discountAmount,
        BigDecimal finalTotal,
        String currency) {

    public static PromotionEvaluationResponse none(BigDecimal subtotal, String currency) {
        return new PromotionEvaluationResponse(
                null, null, null, BigDecimal.ZERO, BigDecimal.ZERO, subtotal, currency);
    }

    public static PromotionEvaluationResponse applied(
            MarketingPromotion promotion,
            BigDecimal discountAmount,
            BigDecimal finalTotal,
            String currency) {
        return new PromotionEvaluationResponse(
                promotion.getId(),
                promotion.getName(),
                promotion.getDiscountType() == null
                        ? null
                        : promotion.getDiscountType().name().toLowerCase(Locale.ROOT),
                promotion.getDiscountValue(),
                discountAmount,
                finalTotal,
                currency);
    }
}

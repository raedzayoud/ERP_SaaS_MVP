package com.erp.erp.marketing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.PromotionEvaluationRequest;
import com.erp.erp.marketing.dto.PromotionEvaluationResponse;
import com.erp.erp.marketing.dto.PromotionResponse;
import com.erp.erp.marketing.model.DiscountType;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.marketing.repository.SegmentMemberRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PromotionEvaluationService {

    private final MarketingPromotionRepository promotions;
    private final SegmentMemberRepository members;

    public PromotionEvaluationService(
            MarketingPromotionRepository promotions, SegmentMemberRepository members) {
        this.promotions = promotions;
        this.members = members;
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> eligible(Tenant tenant, String customerId, LocalDate date) {
        LocalDate day = date == null ? LocalDate.now() : date;
        Set<UUID> segmentIds = segmentIds(tenant, customerId);
        if (segmentIds.isEmpty()) {
            return List.of();
        }

        return promotions.findByTenantIdAndActiveTrueOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(promotion -> promotion.getSegment() != null
                        && segmentIds.contains(promotion.getSegment().getId()))
                .filter(promotion -> isActive(promotion, day))
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PromotionEvaluationResponse evaluate(
            Tenant tenant, PromotionEvaluationRequest request) {
        String currency = request.currency().trim().toUpperCase(Locale.ROOT);
        if (tenant.getCurrency() != null
                && !tenant.getCurrency().equalsIgnoreCase(currency)) {
            throw new AuthException(400, "currency must match workspace currency");
        }

        LocalDate day = request.date() == null ? LocalDate.now() : request.date();
        BigDecimal subtotal = request.subtotal();
        Set<UUID> segmentIds = segmentIds(tenant, request.customerId());
        if (segmentIds.isEmpty()) {
            return PromotionEvaluationResponse.none(subtotal, currency);
        }

        List<MarketingPromotion> eligible = promotions
                .findByTenantIdAndActiveTrueOrderByCreatedAtDesc(tenant.getId())
                .stream()
                .filter(promotion -> promotion.getSegment() != null
                        && segmentIds.contains(promotion.getSegment().getId()))
                .filter(promotion -> isActive(promotion, day))
                .filter(promotion -> promotion.getMinOrderAmount() == null
                        || subtotal.compareTo(promotion.getMinOrderAmount()) >= 0)
                .toList();

        MarketingPromotion best = null;
        BigDecimal bestDiscount = BigDecimal.ZERO;
        for (MarketingPromotion promotion : eligible) {
            BigDecimal discount = discountFor(promotion, subtotal);
            if (best == null
                    || discount.compareTo(bestDiscount) > 0
                    || (discount.compareTo(bestDiscount) == 0
                            && promotion.getEndDate().isBefore(best.getEndDate()))) {
                best = promotion;
                bestDiscount = discount;
            }
        }

        if (best == null) {
            return PromotionEvaluationResponse.none(subtotal, currency);
        }

        BigDecimal finalTotal = subtotal
                .subtract(bestDiscount)
                .max(BigDecimal.ZERO)
                .setScale(2, RoundingMode.HALF_UP);
        return PromotionEvaluationResponse.applied(
                best, bestDiscount.setScale(2, RoundingMode.HALF_UP), finalTotal, currency);
    }

    private Set<UUID> segmentIds(Tenant tenant, String customerId) {
        return members.findByTenantIdAndCustomerRef(tenant.getId(), customerId.trim()).stream()
                .map(member -> member.getSegment().getId())
                .collect(Collectors.toSet());
    }

    private BigDecimal discountFor(MarketingPromotion promotion, BigDecimal subtotal) {
        BigDecimal discount;
        if (promotion.getDiscountType() == DiscountType.FIXED_AMOUNT) {
            discount = promotion.getDiscountValue().min(subtotal);
        } else {
            discount = subtotal
                    .multiply(promotion.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        }
        return discount.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean isActive(MarketingPromotion promotion, LocalDate day) {
        return promotion.isActive()
                && promotion.getStartDate() != null
                && promotion.getEndDate() != null
                && !day.isBefore(promotion.getStartDate())
                && !day.isAfter(promotion.getEndDate());
    }
}

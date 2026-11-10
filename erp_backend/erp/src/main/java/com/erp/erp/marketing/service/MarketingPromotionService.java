package com.erp.erp.marketing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.PromotionRequest;
import com.erp.erp.marketing.dto.PromotionResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.DiscountType;
import com.erp.erp.marketing.model.MarketingCampaign;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.repository.CustomerSegmentRepository;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketingPromotionService {

    private final MarketingPromotionRepository promotions;
    private final MarketingCampaignRepository campaigns;
    private final CustomerSegmentRepository segments;

    public MarketingPromotionService(
            MarketingPromotionRepository promotions,
            MarketingCampaignRepository campaigns,
            CustomerSegmentRepository segments) {
        this.promotions = promotions;
        this.campaigns = campaigns;
        this.segments = segments;
    }

    @Transactional(readOnly = true)
    public List<PromotionResponse> list(
            Tenant tenant,
            String search,
            Boolean active,
            UUID campaignId,
            UUID segmentId) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        return promotions.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(promotion -> active == null || promotion.isActive() == active)
                .filter(promotion -> campaignId == null
                        || (promotion.getCampaign() != null
                                && campaignId.equals(promotion.getCampaign().getId())))
                .filter(promotion -> segmentId == null
                        || (promotion.getSegment() != null
                                && segmentId.equals(promotion.getSegment().getId())))
                .filter(promotion -> query.isEmpty() || matches(promotion, query))
                .map(PromotionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PromotionResponse get(Tenant tenant, UUID id) {
        return PromotionResponse.from(find(tenant, id));
    }

    @Transactional
    public PromotionResponse create(Tenant tenant, PromotionRequest request) {
        MarketingPromotion promotion = new MarketingPromotion();
        promotion.setTenant(tenant);
        apply(tenant, promotion, request);
        return PromotionResponse.from(promotions.save(promotion));
    }

    @Transactional
    public PromotionResponse update(Tenant tenant, UUID id, PromotionRequest request) {
        MarketingPromotion promotion = find(tenant, id);
        apply(tenant, promotion, request);
        promotion.setUpdatedAt(Instant.now());
        return PromotionResponse.from(promotions.save(promotion));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        promotions.delete(find(tenant, id));
    }

    private MarketingPromotion find(Tenant tenant, UUID id) {
        return promotions
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "promotion not found"));
    }

    private void apply(Tenant tenant, MarketingPromotion promotion, PromotionRequest request) {
        validateDates(request.startDate(), request.endDate());
        DiscountType discountType = parseDiscountType(request.discountType());
        BigDecimal discountValue = request.discountValue();
        if (discountType == DiscountType.PERCENTAGE
                && discountValue.compareTo(BigDecimal.valueOf(100)) > 0) {
            throw new AuthException(400, "percentage discount cannot exceed 100");
        }

        MarketingCampaign campaign = null;
        if (request.campaignId() != null) {
            campaign = campaigns
                    .findByIdAndTenantId(request.campaignId(), tenant.getId())
                    .orElseThrow(() -> new AuthException(404, "campaign not found"));
        }

        CustomerSegment segment = segments
                .findByIdAndTenantId(request.segmentId(), tenant.getId())
                .orElseThrow(() -> new AuthException(404, "segment not found"));

        promotion.setName(request.name().trim());
        promotion.setDescription(request.description());
        promotion.setCampaign(campaign);
        promotion.setSegment(segment);
        promotion.setDiscountType(discountType);
        promotion.setDiscountValue(discountValue);
        promotion.setMinOrderAmount(
                request.minOrderAmount() == null ? BigDecimal.ZERO : request.minOrderAmount());
        promotion.setStartDate(request.startDate());
        promotion.setEndDate(request.endDate());
        promotion.setActive(request.active());
    }

    private void validateDates(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new AuthException(400, "end date must not be before start date");
        }
    }

    private DiscountType parseDiscountType(String value) {
        try {
            return DiscountType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid discount type");
        }
    }

    private boolean matches(MarketingPromotion promotion, String query) {
        return contains(promotion.getName(), query)
                || contains(promotion.getDescription(), query)
                || contains(
                        promotion.getCampaign() == null
                                ? null
                                : promotion.getCampaign().getName(),
                        query)
                || contains(
                        promotion.getSegment() == null
                                ? null
                                : promotion.getSegment().getName(),
                        query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}

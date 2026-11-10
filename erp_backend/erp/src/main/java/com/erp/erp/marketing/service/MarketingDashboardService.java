package com.erp.erp.marketing.service;

import com.erp.erp.marketing.dto.MarketingDashboardResponse;
import com.erp.erp.marketing.model.MarketingCampaign;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketingDashboardService {

    private final MarketingCampaignRepository campaigns;
    private final MarketingPromotionRepository promotions;

    public MarketingDashboardService(
            MarketingCampaignRepository campaigns, MarketingPromotionRepository promotions) {
        this.campaigns = campaigns;
        this.promotions = promotions;
    }

    @Transactional(readOnly = true)
    public MarketingDashboardResponse dashboard(Tenant tenant) {
        LocalDate today = LocalDate.now();
        List<MarketingCampaign> tenantCampaigns =
                campaigns.findByTenantIdOrderByCreatedAtDesc(tenant.getId());
        List<MarketingPromotion> tenantPromotions =
                promotions.findByTenantIdOrderByCreatedAtDesc(tenant.getId());

        long activeCampaigns = tenantCampaigns.stream()
                .filter(campaign -> isActive(campaign, today))
                .count();
        long activePromotions = tenantPromotions.stream()
                .filter(promotion -> isActive(promotion, today))
                .count();
        BigDecimal budget = tenantCampaigns.stream()
                .filter(campaign -> isActive(campaign, today))
                .map(campaign -> campaign.getBudget() == null
                        ? BigDecimal.ZERO
                        : campaign.getBudget())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new MarketingDashboardResponse(
                activeCampaigns, activePromotions, budget, tenant.getCurrency());
    }

    private boolean isActive(MarketingCampaign campaign, LocalDate today) {
        return campaign.isActive()
                && campaign.getStartDate() != null
                && campaign.getEndDate() != null
                && !today.isBefore(campaign.getStartDate())
                && !today.isAfter(campaign.getEndDate());
    }

    private boolean isActive(MarketingPromotion promotion, LocalDate today) {
        return promotion.isActive()
                && promotion.getStartDate() != null
                && promotion.getEndDate() != null
                && !today.isBefore(promotion.getStartDate())
                && !today.isAfter(promotion.getEndDate());
    }
}

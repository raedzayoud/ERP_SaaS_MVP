package com.erp.erp.marketing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.marketing.dto.MarketingDashboardResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.DiscountType;
import com.erp.erp.marketing.model.MarketingCampaign;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MarketingDashboardServiceTest {

    private final MarketingCampaignRepository campaigns =
            mock(MarketingCampaignRepository.class);
    private final MarketingPromotionRepository promotions =
            mock(MarketingPromotionRepository.class);
    private final MarketingDashboardService service =
            new MarketingDashboardService(campaigns, promotions);

    @Test
    void countsOnlyActiveCampaignsAndPromotionsInRange() {
        Tenant tenant = tenant();
        CustomerSegment segment = new CustomerSegment();
        segment.setId(UUID.randomUUID());
        segment.setTenant(tenant);

        when(campaigns.findByTenantIdOrderByCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(
                        campaign(true, LocalDate.now().minusDays(1), LocalDate.now(), "100"),
                        campaign(true, LocalDate.now().minusDays(5), LocalDate.now().minusDays(1), "50"),
                        campaign(false, LocalDate.now().minusDays(1), LocalDate.now(), "25")));
        when(promotions.findByTenantIdOrderByCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(
                        promotion(segment, true, LocalDate.now().minusDays(1), LocalDate.now()),
                        promotion(segment, true, LocalDate.now(), LocalDate.now().plusDays(1)),
                        promotion(segment, false, LocalDate.now(), LocalDate.now())));

        MarketingDashboardResponse response = service.dashboard(tenant);

        assertEquals(1, response.activeCampaigns());
        assertEquals(2, response.activePromotions());
        assertEquals(new BigDecimal("100"), response.marketingBudget());
        assertEquals("USD", response.currency());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setCurrency("USD");
        return tenant;
    }

    private MarketingCampaign campaign(
            boolean active, LocalDate start, LocalDate end, String budget) {
        MarketingCampaign campaign = new MarketingCampaign();
        campaign.setId(UUID.randomUUID());
        campaign.setActive(active);
        campaign.setStartDate(start);
        campaign.setEndDate(end);
        campaign.setBudget(new BigDecimal(budget));
        return campaign;
    }

    private MarketingPromotion promotion(
            CustomerSegment segment, boolean active, LocalDate start, LocalDate end) {
        MarketingPromotion promotion = new MarketingPromotion();
        promotion.setId(UUID.randomUUID());
        promotion.setSegment(segment);
        promotion.setDiscountType(DiscountType.PERCENTAGE);
        promotion.setDiscountValue(BigDecimal.TEN);
        promotion.setActive(active);
        promotion.setStartDate(start);
        promotion.setEndDate(end);
        return promotion;
    }
}

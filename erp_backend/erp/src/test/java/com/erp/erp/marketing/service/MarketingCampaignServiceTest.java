package com.erp.erp.marketing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.CampaignRequest;
import com.erp.erp.marketing.dto.CampaignResponse;
import com.erp.erp.marketing.model.CampaignChannel;
import com.erp.erp.marketing.model.MarketingCampaign;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MarketingCampaignServiceTest {

    private final MarketingCampaignRepository campaigns =
            mock(MarketingCampaignRepository.class);
    private final MarketingPromotionRepository promotions =
            mock(MarketingPromotionRepository.class);
    private final MarketingCampaignService service =
            new MarketingCampaignService(campaigns, promotions);

    @Test
    void createsACampaignWithNormalizedChannelAndCurrency() {
        Tenant tenant = tenant();
        when(campaigns.save(any(MarketingCampaign.class)))
                .thenAnswer(call -> call.getArgument(0));

        CampaignResponse response = service.create(
                tenant,
                new CampaignRequest(
                        "  Spring launch ",
                        "Email blast",
                        "email",
                        LocalDate.of(2026, 3, 1),
                        LocalDate.of(2026, 3, 31),
                        new BigDecimal("500.00"),
                        "usd",
                        true));

        assertEquals("Spring launch", response.name());
        assertEquals(CampaignChannel.EMAIL.name().toLowerCase(), response.channel());
        assertEquals("USD", response.currency());
    }

    @Test
    void rejectsAnEndDateBeforeTheStartDate() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant(),
                        new CampaignRequest(
                                "Spring launch",
                                null,
                                "email",
                                LocalDate.of(2026, 3, 31),
                                LocalDate.of(2026, 3, 1),
                                BigDecimal.ZERO,
                                "USD",
                                true)));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void doesNotDeleteACampaignThatHasPromotions() {
        Tenant tenant = tenant();
        MarketingCampaign campaign = campaign(tenant);
        when(campaigns.findByIdAndTenantId(campaign.getId(), tenant.getId()))
                .thenReturn(Optional.of(campaign));
        when(promotions.existsByCampaignIdAndTenantId(campaign.getId(), tenant.getId()))
                .thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.delete(tenant, campaign.getId()));

        assertEquals(409, ex.getStatus());
    }

    @Test
    void deletesACampaignWithoutPromotions() {
        Tenant tenant = tenant();
        MarketingCampaign campaign = campaign(tenant);
        when(campaigns.findByIdAndTenantId(campaign.getId(), tenant.getId()))
                .thenReturn(Optional.of(campaign));

        service.delete(tenant, campaign.getId());

        verify(campaigns).delete(campaign);
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }

    private MarketingCampaign campaign(Tenant tenant) {
        MarketingCampaign campaign = new MarketingCampaign();
        campaign.setId(UUID.randomUUID());
        campaign.setTenant(tenant);
        campaign.setName("Spring launch");
        return campaign;
    }
}

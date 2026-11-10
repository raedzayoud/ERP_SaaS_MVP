package com.erp.erp.marketing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.PromotionRequest;
import com.erp.erp.marketing.dto.PromotionResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.DiscountType;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.repository.CustomerSegmentRepository;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MarketingPromotionServiceTest {

    private final MarketingPromotionRepository promotions =
            mock(MarketingPromotionRepository.class);
    private final MarketingCampaignRepository campaigns =
            mock(MarketingCampaignRepository.class);
    private final CustomerSegmentRepository segments =
            mock(CustomerSegmentRepository.class);
    private final MarketingPromotionService service =
            new MarketingPromotionService(promotions, campaigns, segments);

    @Test
    void createsAPromotionWithDefaultMinimumOrder() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));
        when(promotions.save(any(MarketingPromotion.class)))
                .thenAnswer(call -> call.getArgument(0));

        PromotionResponse response = service.create(
                tenant,
                new PromotionRequest(
                        "  Ten percent ",
                        null,
                        null,
                        segment.getId(),
                        "percentage",
                        new BigDecimal("10"),
                        null,
                        LocalDate.of(2026, 3, 1),
                        LocalDate.of(2026, 3, 31),
                        true));

        assertEquals("Ten percent", response.name());
        assertEquals(DiscountType.PERCENTAGE.name().toLowerCase(), response.discountType());
        assertEquals(BigDecimal.ZERO, response.minOrderAmount());
    }

    @Test
    void rejectsAPercentageAboveOneHundred() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant,
                        new PromotionRequest(
                                "Too much",
                                null,
                                null,
                                segment.getId(),
                                "percentage",
                                new BigDecimal("150"),
                                BigDecimal.ZERO,
                                LocalDate.of(2026, 3, 1),
                                LocalDate.of(2026, 3, 31),
                                true)));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void rejectsAnUnknownDiscountType() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant,
                        new PromotionRequest(
                                "Mystery",
                                null,
                                null,
                                segment.getId(),
                                "bogo",
                                new BigDecimal("10"),
                                BigDecimal.ZERO,
                                LocalDate.of(2026, 3, 1),
                                LocalDate.of(2026, 3, 31),
                                true)));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void doesNotUseACampaignFromAnotherTenant() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        UUID campaignId = UUID.randomUUID();
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));
        when(campaigns.findByIdAndTenantId(campaignId, tenant.getId()))
                .thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant,
                        new PromotionRequest(
                                "Ten percent",
                                null,
                                campaignId,
                                segment.getId(),
                                "percentage",
                                new BigDecimal("10"),
                                BigDecimal.ZERO,
                                LocalDate.of(2026, 3, 1),
                                LocalDate.of(2026, 3, 31),
                                true)));

        assertEquals(404, ex.getStatus());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }

    private CustomerSegment segment(Tenant tenant) {
        CustomerSegment segment = new CustomerSegment();
        segment.setId(UUID.randomUUID());
        segment.setTenant(tenant);
        segment.setName("VIP customers");
        return segment;
    }
}

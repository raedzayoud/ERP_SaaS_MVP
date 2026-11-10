package com.erp.erp.marketing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.PromotionEvaluationRequest;
import com.erp.erp.marketing.dto.PromotionEvaluationResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.DiscountType;
import com.erp.erp.marketing.model.MarketingPromotion;
import com.erp.erp.marketing.model.SegmentMember;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.marketing.repository.SegmentMemberRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PromotionEvaluationServiceTest {

    private final MarketingPromotionRepository promotions =
            mock(MarketingPromotionRepository.class);
    private final SegmentMemberRepository members = mock(SegmentMemberRepository.class);
    private final PromotionEvaluationService service =
            new PromotionEvaluationService(promotions, members);

    @Test
    void appliesTheLargestDiscount() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        givenCustomer(tenant, segment);
        MarketingPromotion five = promotion(segment, DiscountType.PERCENTAGE, "5", "0", 2);
        MarketingPromotion twenty = promotion(segment, DiscountType.PERCENTAGE, "20", "0", 3);
        givenPromotions(tenant, five, twenty);

        PromotionEvaluationResponse response = service.evaluate(
                tenant,
                new PromotionEvaluationRequest(
                        "c1", new BigDecimal("100.00"), "USD", LocalDate.now()));

        assertEquals(twenty.getId(), response.promotionId());
        assertEquals(new BigDecimal("20.00"), response.discountAmount());
        assertEquals(new BigDecimal("80.00"), response.finalTotal());
    }

    @Test
    void breaksATieWithTheEarliestEndDate() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        givenCustomer(tenant, segment);
        MarketingPromotion later = promotion(segment, DiscountType.PERCENTAGE, "10", "0", 5);
        MarketingPromotion sooner = promotion(segment, DiscountType.PERCENTAGE, "10", "0", 2);
        givenPromotions(tenant, later, sooner);

        PromotionEvaluationResponse response = service.evaluate(
                tenant,
                new PromotionEvaluationRequest(
                        "c1", new BigDecimal("100.00"), "USD", LocalDate.now()));

        assertEquals(sooner.getId(), response.promotionId());
    }

    @Test
    void skipsPromotionsBelowTheMinimumOrder() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        givenCustomer(tenant, segment);
        givenPromotions(
                tenant, promotion(segment, DiscountType.FIXED_AMOUNT, "10", "200", 3));

        PromotionEvaluationResponse response = service.evaluate(
                tenant,
                new PromotionEvaluationRequest(
                        "c1", new BigDecimal("100.00"), "USD", LocalDate.now()));

        assertNull(response.promotionId());
        assertEquals(BigDecimal.ZERO, response.discountAmount());
        assertEquals(new BigDecimal("100.00"), response.finalTotal());
    }

    @Test
    void capsAFixedDiscountAtTheSubtotal() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        givenCustomer(tenant, segment);
        givenPromotions(
                tenant, promotion(segment, DiscountType.FIXED_AMOUNT, "150", "0", 3));

        PromotionEvaluationResponse response = service.evaluate(
                tenant,
                new PromotionEvaluationRequest(
                        "c1", new BigDecimal("100.00"), "USD", LocalDate.now()));

        assertEquals(new BigDecimal("100.00"), response.discountAmount());
        assertEquals(new BigDecimal("0.00"), response.finalTotal());
    }

    @Test
    void returnsNoPromotionWhenTheCustomerIsNotInAnySegment() {
        Tenant tenant = tenant();
        when(members.findByTenantIdAndCustomerRef(tenant.getId(), "c1"))
                .thenReturn(List.of());

        PromotionEvaluationResponse response = service.evaluate(
                tenant,
                new PromotionEvaluationRequest(
                        "c1", new BigDecimal("100.00"), "USD", LocalDate.now()));

        assertNull(response.promotionId());
    }

    @Test
    void rejectsACurrencyThatDoesNotMatchTheWorkspace() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.evaluate(
                        tenant(),
                        new PromotionEvaluationRequest(
                                "c1", new BigDecimal("100.00"), "EUR", LocalDate.now())));

        assertEquals(400, ex.getStatus());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setCurrency("USD");
        return tenant;
    }

    private CustomerSegment segment(Tenant tenant) {
        CustomerSegment segment = new CustomerSegment();
        segment.setId(UUID.randomUUID());
        segment.setTenant(tenant);
        segment.setName("VIP customers");
        return segment;
    }

    private void givenCustomer(Tenant tenant, CustomerSegment segment) {
        SegmentMember member = new SegmentMember();
        member.setTenant(tenant);
        member.setSegment(segment);
        member.setCustomerRef("c1");
        when(members.findByTenantIdAndCustomerRef(tenant.getId(), "c1"))
                .thenReturn(List.of(member));
    }

    private void givenPromotions(Tenant tenant, MarketingPromotion... list) {
        when(promotions.findByTenantIdAndActiveTrueOrderByCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(list));
    }

    private MarketingPromotion promotion(
            CustomerSegment segment,
            DiscountType type,
            String value,
            String minOrder,
            int daysUntilEnd) {
        MarketingPromotion promotion = new MarketingPromotion();
        promotion.setId(UUID.randomUUID());
        promotion.setSegment(segment);
        promotion.setName(type.name() + " " + value);
        promotion.setDiscountType(type);
        promotion.setDiscountValue(new BigDecimal(value));
        promotion.setMinOrderAmount(new BigDecimal(minOrder));
        promotion.setStartDate(LocalDate.now().minusDays(1));
        promotion.setEndDate(LocalDate.now().plusDays(daysUntilEnd));
        promotion.setActive(true);
        return promotion;
    }
}

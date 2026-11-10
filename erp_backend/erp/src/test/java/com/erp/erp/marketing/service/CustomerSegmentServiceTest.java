package com.erp.erp.marketing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.SegmentRequest;
import com.erp.erp.marketing.dto.SegmentResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.SegmentMember;
import com.erp.erp.marketing.repository.CustomerSegmentRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.marketing.repository.SegmentMemberRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CustomerSegmentServiceTest {

    private final CustomerSegmentRepository segments =
            mock(CustomerSegmentRepository.class);
    private final SegmentMemberRepository members = mock(SegmentMemberRepository.class);
    private final MarketingPromotionRepository promotions =
            mock(MarketingPromotionRepository.class);
    private final CustomerSegmentService service =
            new CustomerSegmentService(segments, members, promotions);

    @Test
    void createsASegmentWithTrimmedDeduplicatedMembers() {
        Tenant tenant = tenant();
        when(segments.save(any(CustomerSegment.class)))
                .thenAnswer(call -> call.getArgument(0));

        SegmentResponse response = service.create(
                tenant,
                new SegmentRequest(
                        "  VIP customers ",
                        "High value",
                        List.of(" c1 ", "c1", "", "c2")));

        assertEquals("VIP customers", response.name());
        assertEquals(0, response.memberCount());
        verify(members, times(2)).save(any(SegmentMember.class));
    }

    @Test
    void doesNotDeleteASegmentUsedByAPromotion() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));
        when(promotions.existsBySegmentIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.delete(tenant, segment.getId()));

        assertEquals(409, ex.getStatus());
        verify(segments, never()).delete(any(CustomerSegment.class));
    }

    @Test
    void deletesMembersBeforeTheSegment() {
        Tenant tenant = tenant();
        CustomerSegment segment = segment(tenant);
        when(segments.findByIdAndTenantId(segment.getId(), tenant.getId()))
                .thenReturn(Optional.of(segment));

        service.delete(tenant, segment.getId());

        verify(members).deleteByTenantIdAndSegmentId(tenant.getId(), segment.getId());
        verify(segments).delete(segment);
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

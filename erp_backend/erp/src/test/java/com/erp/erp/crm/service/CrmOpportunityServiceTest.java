package com.erp.erp.crm.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.OpportunityRequest;
import com.erp.erp.crm.dto.OpportunityResponse;
import com.erp.erp.crm.model.CrmOpportunity;
import com.erp.erp.crm.model.OpportunityStage;
import com.erp.erp.crm.repository.CrmOpportunityRepository;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CrmOpportunityServiceTest {

    private final CrmOpportunityRepository opportunities = mock(CrmOpportunityRepository.class);
    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final CrmOpportunityService service =
            new CrmOpportunityService(opportunities, partners);

    @Test
    void createsAnOpportunityWithTheTenantCurrency() {
        Tenant tenant = tenant();
        UUID customerId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(customerId, tenant.getId())).thenReturn(true);
        when(opportunities.save(any(CrmOpportunity.class))).thenAnswer(call -> call.getArgument(0));

        OpportunityResponse response = service.create(tenant, request(customerId, "24000"));

        assertEquals("TND", response.currency());
        assertEquals("qualification", response.stage());
        assertEquals(0, new BigDecimal("24000.00").compareTo(response.amount()));
    }

    @Test
    void rejectsAnUnknownCustomer() {
        Tenant tenant = tenant();
        UUID customerId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(customerId, tenant.getId())).thenReturn(false);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request(customerId, "24000")));

        assertEquals(400, ex.getStatus());
        assertEquals("noCustomer", ex.getCode());
    }

    @Test
    void rejectsAnAmountOfZero() {
        Tenant tenant = tenant();
        UUID customerId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(customerId, tenant.getId())).thenReturn(true);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request(customerId, "0")));

        assertEquals(400, ex.getStatus());
        assertEquals("invalidAmount", ex.getCode());
    }

    @Test
    void refusesToMoveAClosedDeal() {
        Tenant tenant = tenant();
        CrmOpportunity opportunity = opportunity(tenant, OpportunityStage.WON);
        when(opportunities.findByIdAndTenantId(opportunity.getId(), tenant.getId()))
                .thenReturn(Optional.of(opportunity));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.updateStage(tenant, opportunity.getId(), "negotiation"));

        assertEquals(409, ex.getStatus());
        assertEquals("stageClosed", ex.getCode());
    }

    private OpportunityRequest request(UUID customerId, String amount) {
        return new OpportunityRequest(
                "Carthage rollout",
                customerId.toString(),
                "qualification",
                new BigDecimal(amount),
                LocalDate.of(2026, 11, 20),
                null,
                "Full suite demo requested.");
    }

    private CrmOpportunity opportunity(Tenant tenant, OpportunityStage stage) {
        CrmOpportunity opportunity = new CrmOpportunity();
        opportunity.setId(UUID.randomUUID());
        opportunity.setTenant(tenant);
        opportunity.setName("Horizon founder pack");
        opportunity.setCustomerId(UUID.randomUUID());
        opportunity.setStage(stage);
        opportunity.setAmount(new BigDecimal("6400.00"));
        opportunity.setExpectedCloseDate(LocalDate.of(2026, 10, 2));
        return opportunity;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setCurrency("TND");
        return tenant;
    }
}

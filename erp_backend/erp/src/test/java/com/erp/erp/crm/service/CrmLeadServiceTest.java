package com.erp.erp.crm.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.LeadConversionResponse;
import com.erp.erp.crm.dto.LeadRequest;
import com.erp.erp.crm.dto.LeadResponse;
import com.erp.erp.crm.model.CrmLead;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.model.LeadStatus;
import com.erp.erp.crm.model.PartnerKind;
import com.erp.erp.crm.repository.CrmLeadRepository;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CrmLeadServiceTest {

    private final CrmLeadRepository leads = mock(CrmLeadRepository.class);
    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final CrmLeadService service = new CrmLeadService(leads, partners);

    @Test
    void createsALeadWithTheNewStatus() {
        Tenant tenant = tenant();
        when(leads.save(any(CrmLead.class))).thenAnswer(call -> call.getArgument(0));

        LeadResponse response =
                service.create(
                        tenant,
                        new LeadRequest(
                                "Nadia Trabelsi",
                                "Carthage Logistics",
                                "Nadia@Example.com",
                                "+216 71 000 001",
                                "website",
                                "Asked for a demo."));

        assertEquals("new", response.status());
        assertEquals("nadia@example.com", response.email());
        assertEquals("website", response.source());
    }

    @Test
    void convertsALeadIntoAContact() {
        Tenant tenant = tenant();
        CrmLead lead = lead(tenant, LeadStatus.QUALIFIED);
        when(leads.findByIdAndTenantId(lead.getId(), tenant.getId()))
                .thenReturn(Optional.of(lead));
        when(leads.save(any(CrmLead.class))).thenAnswer(call -> call.getArgument(0));
        when(partners.save(any(CrmPartner.class))).thenAnswer(call -> {
            CrmPartner partner = call.getArgument(0);
            partner.setId(UUID.randomUUID());
            return partner;
        });

        LeadConversionResponse response = service.convert(tenant, lead.getId());

        assertEquals("converted", response.lead().status());
        assertEquals(response.partnerId(), response.lead().convertedPartnerId());

        ArgumentCaptor<CrmPartner> captor = ArgumentCaptor.forClass(CrmPartner.class);
        verify(partners).save(captor.capture());
        CrmPartner partner = captor.getValue();
        assertEquals(PartnerKind.COMPANY, partner.getKind());
        assertEquals("Carthage Logistics", partner.getName());
        assertEquals(true, partner.isCustomer());
    }

    @Test
    void refusesToConvertAnAlreadyConvertedLead() {
        Tenant tenant = tenant();
        CrmLead lead = lead(tenant, LeadStatus.CONVERTED);
        when(leads.findByIdAndTenantId(lead.getId(), tenant.getId()))
                .thenReturn(Optional.of(lead));

        AuthException ex =
                assertThrows(AuthException.class, () -> service.convert(tenant, lead.getId()));

        assertEquals(409, ex.getStatus());
        assertEquals("alreadyConverted", ex.getCode());
    }

    @Test
    void refusesToConvertALostLead() {
        Tenant tenant = tenant();
        CrmLead lead = lead(tenant, LeadStatus.LOST);
        when(leads.findByIdAndTenantId(lead.getId(), tenant.getId()))
                .thenReturn(Optional.of(lead));

        AuthException ex =
                assertThrows(AuthException.class, () -> service.convert(tenant, lead.getId()));

        assertEquals(409, ex.getStatus());
        assertEquals("lostLead", ex.getCode());
    }

    private CrmLead lead(Tenant tenant, LeadStatus status) {
        CrmLead lead = new CrmLead();
        lead.setId(UUID.randomUUID());
        lead.setTenant(tenant);
        lead.setName("Nadia Trabelsi");
        lead.setCompany("Carthage Logistics");
        lead.setEmail("nadia@example.com");
        lead.setStatus(status);
        return lead;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

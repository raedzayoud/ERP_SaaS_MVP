package com.erp.erp.crm.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.LeadConversionResponse;
import com.erp.erp.crm.dto.LeadRequest;
import com.erp.erp.crm.dto.LeadResponse;
import com.erp.erp.crm.dto.PartnerAddress;
import com.erp.erp.crm.dto.PartnerRequest;
import com.erp.erp.crm.dto.PartnerResponse;
import com.erp.erp.crm.model.CrmLead;
import com.erp.erp.crm.model.LeadStatus;
import com.erp.erp.crm.repository.CrmLeadRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class CrmLeadServiceTest {

    private static final UUID PARTNER_ID = UUID.randomUUID();

    private final CrmLeadRepository leads = mock(CrmLeadRepository.class);
    private final CrmPartnerService partnerService = mock(CrmPartnerService.class);
    private final CrmLeadService service = new CrmLeadService(leads, partnerService);

    @Test
    void createsALeadWithTheNewStatus() {
        Tenant tenant = tenant();
        when(leads.save(any(CrmLead.class))).thenAnswer(call -> call.getArgument(0));

        LeadResponse response = service.create(tenant, request("Nadia Trabelsi", "nadia@example.com", ""));

        assertEquals("new", response.status());
        assertEquals("nadia@example.com", response.email());
        assertEquals("website", response.source());
    }

    @Test
    void refusesALeadWithoutEmailAndPhone() {
        Tenant tenant = tenant();
        LeadRequest request =
                new LeadRequest("Nadia Trabelsi", "", "", "", "website", "Asked for a demo.");

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request));

        assertEquals(400, ex.getStatus());
        assertEquals("noContactInfo", ex.getCode());
    }

    @Test
    void rejectsADuplicateLeadEmail() {
        Tenant tenant = tenant();
        when(leads.existsByTenantIdAndEmailIgnoreCase(tenant.getId(), "nadia@example.com"))
                .thenReturn(true);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request("Nadia Trabelsi", "nadia@example.com", "")));

        assertEquals(409, ex.getStatus());
        assertEquals("duplicateLead", ex.getCode());
    }

    @Test
    void rejectsADuplicateLeadNameAndCompany() {
        Tenant tenant = tenant();
        when(leads.existsByTenantIdAndNameIgnoreCaseAndCompanyIgnoreCase(
                        tenant.getId(), "Nadia Trabelsi", "Carthage Logistics"))
                .thenReturn(true);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.create(
                                        tenant,
                                        request(
                                                "Nadia Trabelsi",
                                                "other@example.com",
                                                "Carthage Logistics")));

        assertEquals(409, ex.getStatus());
        assertEquals("duplicateLead", ex.getCode());
    }

    @Test
    void convertsALeadIntoAContact() {
        Tenant tenant = tenant();
        CrmLead lead = lead(tenant, LeadStatus.QUALIFIED);
        when(leads.findByIdAndTenantId(lead.getId(), tenant.getId()))
                .thenReturn(Optional.of(lead));
        when(leads.save(any(CrmLead.class))).thenAnswer(call -> call.getArgument(0));
        when(partnerService.create(any(Tenant.class), any(PartnerRequest.class)))
                .thenReturn(
                        new PartnerResponse(
                                PARTNER_ID,
                                "company",
                                "Carthage Logistics",
                                null,
                                true,
                                false,
                                "",
                                "nadia@example.com",
                                "",
                                "",
                                new PartnerAddress("", "", ""),
                                true,
                                "",
                                "",
                                ""));

        LeadConversionResponse response = service.convert(tenant, lead.getId());

        assertEquals("converted", response.lead().status());
        assertEquals(response.partnerId(), response.lead().convertedPartnerId());

        ArgumentCaptor<PartnerRequest> captor = ArgumentCaptor.forClass(PartnerRequest.class);
        verify(partnerService).create(eq(tenant), captor.capture());
        assertEquals("company", captor.getValue().kind());
        assertEquals("Carthage Logistics", captor.getValue().name());
        assertEquals(true, captor.getValue().isCustomer());
    }

    @Test
    void refusesToConvertALeadWithoutEmail() {
        Tenant tenant = tenant();
        CrmLead lead = lead(tenant, LeadStatus.QUALIFIED);
        lead.setEmail("");
        when(leads.findByIdAndTenantId(lead.getId(), tenant.getId()))
                .thenReturn(Optional.of(lead));

        AuthException ex =
                assertThrows(AuthException.class, () -> service.convert(tenant, lead.getId()));

        assertEquals(400, ex.getStatus());
        assertEquals("noEmail", ex.getCode());
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

    private LeadRequest request(String name, String email, String company) {
        return new LeadRequest(
                name, company, email, "+216 71 000 001", "website", "Asked for a demo.");
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

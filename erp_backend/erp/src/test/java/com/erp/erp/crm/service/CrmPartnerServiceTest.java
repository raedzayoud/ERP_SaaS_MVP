package com.erp.erp.crm.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.PageResponse;
import com.erp.erp.crm.dto.PartnerAddress;
import com.erp.erp.crm.dto.PartnerRequest;
import com.erp.erp.crm.dto.PartnerResponse;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.model.PartnerKind;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CrmPartnerServiceTest {

    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final CrmPartnerService service = new CrmPartnerService(partners);

    @Test
    void createsAContactWithTrimmedFieldsAndTheActiveFlag() {
        Tenant tenant = tenant();
        when(partners.save(any(CrmPartner.class))).thenAnswer(call -> call.getArgument(0));

        PartnerResponse response = service.create(tenant, request(" Acme Corp ", null));

        assertEquals("Acme Corp", response.name());
        assertEquals("person", response.kind());
        assertEquals(true, response.active());
        assertEquals("billing@acme.com", response.email());
        assertEquals("Paris", response.address().city());
    }

    @Test
    void doesNotFindAContactFromAnotherTenant() {
        Tenant tenant = tenant();
        UUID id = UUID.randomUUID();
        when(partners.findByIdAndTenantId(id, tenant.getId())).thenReturn(Optional.empty());

        AuthException ex =
                assertThrows(AuthException.class, () -> service.get(tenant, id));

        assertEquals(404, ex.getStatus());
        assertEquals("notFound", ex.getCode());
    }

    @Test
    void filtersTheListBySearchAndActiveFlag() {
        Tenant tenant = tenant();
        when(partners.findByTenantIdOrderByNameAsc(tenant.getId()))
                .thenReturn(
                        List.of(
                                partner(tenant, "Acme Corp", true),
                                partner(tenant, "Atlas Digital", true),
                                partner(tenant, "Old Contact", false)));

        PageResponse<PartnerResponse> page =
                service.list(tenant, 0, 10, "digital", null, true, "name,asc");

        assertEquals(1, page.total());
        assertEquals("Atlas Digital", page.items().get(0).name());
    }

    @Test
    void returnsTheRequestedPage() {
        Tenant tenant = tenant();
        when(partners.findByTenantIdOrderByNameAsc(tenant.getId()))
                .thenReturn(
                        List.of(
                                partner(tenant, "Acme Corp", true),
                                partner(tenant, "Atlas Digital", true),
                                partner(tenant, "Nord Industries", true)));

        PageResponse<PartnerResponse> page =
                service.list(tenant, 1, 1, null, null, null, "name,asc");

        assertEquals(3, page.total());
        assertEquals(1, page.page());
        assertEquals(1, page.size());
        assertEquals("Atlas Digital", page.items().get(0).name());
    }

    @Test
    void rejectsAnUnknownParentCompany() {
        Tenant tenant = tenant();
        UUID parentId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(parentId, tenant.getId())).thenReturn(false);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request("Acme Corp", parentId.toString())));

        assertEquals(404, ex.getStatus());
        assertEquals("notFound", ex.getCode());
    }

    private PartnerRequest request(String name, String parentId) {
        return new PartnerRequest(
                "person",
                name,
                parentId,
                true,
                false,
                " 12034567 ",
                "Billing@ACME.com",
                " +1 415 ",
                "Manager",
                new PartnerAddress(" 120 Market Street ", " Paris ", "FR"),
                " note ");
    }

    private CrmPartner partner(Tenant tenant, String name, boolean active) {
        CrmPartner partner = new CrmPartner();
        partner.setId(UUID.randomUUID());
        partner.setTenant(tenant);
        partner.setKind(PartnerKind.COMPANY);
        partner.setName(name);
        partner.setActive(active);
        return partner;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

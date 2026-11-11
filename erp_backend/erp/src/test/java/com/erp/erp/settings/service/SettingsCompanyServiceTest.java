package com.erp.erp.settings.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.settings.dto.CompanySettingsRequest;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SettingsCompanyServiceTest {

    private final TenantRepository tenants = mock(TenantRepository.class);
    private final SettingsCompanyService service = new SettingsCompanyService(tenants);

    @Test
    void updatesOnlyEditableCompanyFields() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setSubdomain("acme");
        tenant.setPlanId("business");
        tenant.setEmail("old@acme.com");
        tenant.setTaxId("OLD123");
        when(tenants.save(tenant)).thenReturn(tenant);

        TenantResponse response = service.update(
                tenant,
                new CompanySettingsRequest(
                        " Acme Corp ",
                        "eur",
                        " 1 Main St ",
                        "FR",
                        "fr",
                        "11-50"));

        assertEquals("Acme Corp", response.companyName());
        assertEquals("old@acme.com", response.email());
        assertEquals("EUR", response.currency());
        assertEquals("OLD123", response.taxId());
        assertEquals("1 Main St", response.address());
        assertEquals("acme", response.subdomain());
        assertEquals("business", response.planId());
        verify(tenants).save(tenant);
    }
}

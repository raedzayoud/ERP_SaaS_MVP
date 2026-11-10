package com.erp.erp.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.admin.dto.AdminTenantResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AdminTenantServiceTest {

    private final TenantRepository tenants = mock(TenantRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final AdminTenantService service = new AdminTenantService(tenants, users);

    @Test
    void listsTenantsWithTheirUserCount() {
        Tenant tenant = tenant(TenantStatus.TRIAL);
        when(tenants.findByKycStatusNotOrderByCreatedAtDesc(KycStatus.REJECTED))
                .thenReturn(List.of(tenant));
        when(users.countByTenantId(tenant.getId())).thenReturn(3L);

        List<AdminTenantResponse> result = service.list();

        assertEquals(1, result.size());
        assertEquals("trial", result.get(0).status());
        assertEquals(3L, result.get(0).usersCount());
        assertEquals(4, result.get(0).trialUsed());
        assertEquals(30, result.get(0).trialLimit());
    }

    @Test
    void suspendsAndReactivatesATenant() {
        Tenant tenant = tenant(TenantStatus.ACTIVE);
        when(tenants.findById(tenant.getId())).thenReturn(Optional.of(tenant));

        AdminTenantResponse suspended = service.updateStatus(tenant.getId(), "suspended");
        assertEquals(TenantStatus.SUSPENDED, tenant.getTenantStatus());
        assertEquals("suspended", suspended.status());

        AdminTenantResponse active = service.updateStatus(tenant.getId(), "ACTIVE");
        assertEquals(TenantStatus.ACTIVE, tenant.getTenantStatus());
        assertEquals("active", active.status());
    }

    @Test
    void rejectsTrialAndUnknownStatuses() {
        Tenant tenant = tenant(TenantStatus.ACTIVE);
        when(tenants.findById(tenant.getId())).thenReturn(Optional.of(tenant));

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.updateStatus(tenant.getId(), "TRIAL"));

        assertEquals(400, ex.getStatus());
        assertEquals("status must be ACTIVE or SUSPENDED", ex.getMessage());
    }

    @Test
    void rejectsAnUnknownTenant() {
        UUID id = UUID.randomUUID();
        when(tenants.findById(id)).thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.updateStatus(id, "ACTIVE"));

        assertEquals(404, ex.getStatus());
        assertEquals("tenant not found", ex.getMessage());
    }

    private Tenant tenant(TenantStatus status) {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setCompanyName("Acme");
        tenant.setSubdomain("acme");
        tenant.setEmail("owner@acme.com");
        tenant.setPlanId("starter");
        tenant.setTenantStatus(status);
        tenant.setKycStatus(KycStatus.APPROVED);
        tenant.setTrialLimit(30);
        tenant.setTrialUsed(4);
        return tenant;
    }
}

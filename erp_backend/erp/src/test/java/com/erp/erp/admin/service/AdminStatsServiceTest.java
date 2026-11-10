package com.erp.erp.admin.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.admin.dto.AdminStatsResponse;
import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdminStatsServiceTest {

    private final TenantRepository tenants = mock(TenantRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final AdminStatsService service =
            new AdminStatsService(tenants, users, new PlanCatalog());

    @Test
    void aggregatesTenantUsersRevenueAndOverdueAmounts() {
        when(tenants.countByKycStatusNot(KycStatus.REJECTED)).thenReturn(4L);
        when(tenants.countByTenantStatus(TenantStatus.ACTIVE)).thenReturn(2L);
        when(tenants.countByTenantStatus(TenantStatus.TRIAL)).thenReturn(1L);
        when(tenants.countByTenantStatus(TenantStatus.SUSPENDED)).thenReturn(1L);
        when(users.countByTenantIsNotNull()).thenReturn(12L);
        when(tenants.countByKycStatus(KycStatus.PENDING)).thenReturn(2L);
        when(tenants.findByTenantStatus(TenantStatus.ACTIVE)).thenReturn(List.of(
                tenant("starter", BillingInterval.MONTHLY),
                tenant("business", BillingInterval.ANNUAL)));
        when(tenants.findByBillingStatus(BillingStatus.PAST_DUE))
                .thenReturn(List.of(tenant("business", BillingInterval.MONTHLY)));

        AdminStatsResponse stats = service.stats();

        assertEquals(4L, stats.totalTenants());
        assertEquals(2L, stats.activeTenants());
        assertEquals(1L, stats.trialTenants());
        assertEquals(1L, stats.suspendedTenants());
        assertEquals(12L, stats.totalUsers());
        assertEquals(2L, stats.pendingSignups());
        assertEquals(29 + 758 / 12.0, stats.monthlyRevenue(), 0.001);
        assertEquals(79, stats.overdueAmount(), 0.001);
    }

    private Tenant tenant(String planId, BillingInterval interval) {
        Tenant tenant = new Tenant();
        tenant.setPlanId(planId);
        tenant.setBillingInterval(interval);
        return tenant;
    }
}

package com.erp.erp.admin.service;

import com.erp.erp.admin.dto.AdminStatsResponse;
import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Aggregates the counters displayed on the super-admin dashboard. */
@Service
public class AdminStatsService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;
    private final PlanCatalog planCatalog;

    public AdminStatsService(
            TenantRepository tenantRepository,
            UserRepository userRepository,
            PlanCatalog planCatalog) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
        this.planCatalog = planCatalog;
    }

    @Transactional(readOnly = true)
    public AdminStatsResponse stats() {
        double monthlyRevenue = tenantRepository.findByTenantStatus(TenantStatus.ACTIVE).stream()
                .mapToDouble(this::monthlyEquivalent)
                .sum();

        double overdueAmount = tenantRepository.findByBillingStatus(BillingStatus.PAST_DUE).stream()
                .mapToDouble(this::monthlyEquivalent)
                .sum();

        return new AdminStatsResponse(
                tenantRepository.countByKycStatusNot(KycStatus.REJECTED),
                tenantRepository.countByTenantStatus(TenantStatus.ACTIVE),
                tenantRepository.countByTenantStatus(TenantStatus.TRIAL),
                tenantRepository.countByTenantStatus(TenantStatus.SUSPENDED),
                userRepository.countByTenantIsNotNull(),
                monthlyRevenue,
                tenantRepository.countByKycStatus(KycStatus.PENDING),
                overdueAmount);
    }

    private double monthlyEquivalent(Tenant tenant) {
        BillingInterval interval = tenant.getBillingInterval() == null
                ? BillingInterval.MONTHLY
                : tenant.getBillingInterval();
        return planCatalog.monthlyEquivalent(tenant.getPlanId(), interval);
    }
}

package com.erp.erp.admin.dto;

import com.erp.erp.tenant.model.Tenant;
import java.util.Locale;
import java.util.UUID;

public record AdminTenantResponse(
        UUID id,
        String companyName,
        String subdomain,
        String email,
        String taxId,
        String planId,
        String status,
        long usersCount,
        double storageUsedGb,
        String createdAt,
        String kycStatus,
        String billingStatus,
        String billingInterval,
        String currentPeriodEnd,
        int trialUsed,
        int trialLimit,
        String trialStartedAt,
        String trialEndedAt) {

    public static AdminTenantResponse from(Tenant tenant, long usersCount) {
        String status = tenant.getTenantStatus() == null
                ? "active"
                : tenant.getTenantStatus().name().toLowerCase(Locale.ROOT);

        return new AdminTenantResponse(
                tenant.getId(),
                tenant.getCompanyName(),
                tenant.getSubdomain(),
                tenant.getEmail(),
                tenant.getTaxId(),
                tenant.getPlanId(),
                status,
                usersCount,
                0,
                tenant.getCreatedAt() == null ? null : tenant.getCreatedAt().toString(),
                tenant.getKycStatus() == null ? null : tenant.getKycStatus().name(),
                tenant.getBillingStatus() == null ? null : tenant.getBillingStatus().name(),
                tenant.getBillingInterval() == null ? null : tenant.getBillingInterval().name(),
                tenant.getCurrentPeriodEnd() == null
                        ? null
                        : tenant.getCurrentPeriodEnd().toString(),
                tenant.getTrialUsed(),
                tenant.getTrialLimit(),
                tenant.getTrialStartedAt() == null ? null : tenant.getTrialStartedAt().toString(),
                tenant.getTrialEndedAt() == null ? null : tenant.getTrialEndedAt().toString());
    }
}

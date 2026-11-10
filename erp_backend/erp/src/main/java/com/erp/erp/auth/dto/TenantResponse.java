package com.erp.erp.auth.dto;

import com.erp.erp.tenant.model.Tenant;
import java.util.List;
import java.util.UUID;

/** Mirrors the Angular Tenant interface (core/models/tenant.ts), without the user list. */
public record TenantResponse(
        UUID id,
        String companyName,
        String email,
        String subdomain,
        String country,
        String language,
        String companySize,
        String planId,
        List<String> enabledModules,
        String currency,
        String taxId,
        String address,
        String createdAt,
        String tenantStatus,
        String kycStatus,
        String billingStatus,
        String billingInterval,
        String currentPeriodEnd,
        boolean cancelAtPeriodEnd,
        int trialLimit,
        int trialUsed,
        String trialStartedAt,
        String trialEndedAt) {

    public static TenantResponse from(Tenant tenant) {
        return new TenantResponse(
                tenant.getId(),
                tenant.getCompanyName(),
                tenant.getEmail(),
                tenant.getSubdomain(),
                tenant.getCountry(),
                tenant.getLanguage(),
                tenant.getCompanySize(),
                tenant.getPlanId(),
                tenant.getModuleList(),
                tenant.getCurrency(),
                tenant.getTaxId(),
                tenant.getAddress(),
                tenant.getCreatedAt() == null ? null : tenant.getCreatedAt().toString(),
                tenant.getTenantStatus() == null ? null : tenant.getTenantStatus().name(),
                tenant.getKycStatus() == null ? null : tenant.getKycStatus().name(),
                tenant.getBillingStatus() == null ? null : tenant.getBillingStatus().name(),
                tenant.getBillingInterval() == null ? null : tenant.getBillingInterval().name(),
                tenant.getCurrentPeriodEnd() == null ? null : tenant.getCurrentPeriodEnd().toString(),
                tenant.isCancelAtPeriodEnd(),
                tenant.getTrialLimit(),
                tenant.getTrialUsed(),
                tenant.getTrialStartedAt() == null ? null : tenant.getTrialStartedAt().toString(),
                tenant.getTrialEndedAt() == null ? null : tenant.getTrialEndedAt().toString());
    }
}

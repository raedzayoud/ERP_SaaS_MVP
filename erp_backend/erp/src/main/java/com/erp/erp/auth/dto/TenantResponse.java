package com.erp.erp.auth.dto;

import java.util.List;

/** Mirrors the Angular Tenant interface (core/models/tenant.ts), without the user list. */
public record TenantResponse(
        Long id,
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
        String createdAt) {}

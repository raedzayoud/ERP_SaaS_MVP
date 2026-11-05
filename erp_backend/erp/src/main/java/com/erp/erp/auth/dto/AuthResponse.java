package com.erp.erp.auth.dto;

/**
 * What GET /auth/me returns for the authenticated user.
 * Field names match the frontend User and Tenant interfaces exactly.
 */
public record AuthResponse(
        String accessToken,
        String tokenType,
        UserResponse user,
        TenantResponse tenant) {}

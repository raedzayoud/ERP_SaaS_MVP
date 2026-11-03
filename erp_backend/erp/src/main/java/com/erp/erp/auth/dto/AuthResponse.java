package com.erp.erp.auth.dto;

/**
 * What the Angular app receives after a successful login or signup.
 * Field names match the frontend User and Tenant interfaces exactly.
 */
public record AuthResponse(
        String accessToken,
        String tokenType,
        UserResponse user,
        TenantResponse tenant) {}

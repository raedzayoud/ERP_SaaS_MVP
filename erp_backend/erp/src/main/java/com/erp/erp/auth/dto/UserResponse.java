package com.erp.erp.auth.dto;

/** Mirrors the Angular User interface (core/models/user.ts). */
public record UserResponse(
        Long id,
        String name,
        String email,
        String role,
        boolean mustRenewPassword) {}

package com.erp.erp.auth.dto;

import java.util.UUID;

/** Mirrors the Angular User interface (core/models/user.ts). */
public record UserResponse(
        UUID id,
        String name,
        String email,
        String role,
        boolean mustRenewPassword) {}

package com.erp.erp.settings.dto;

import com.erp.erp.user.model.User;
import java.util.UUID;

/** Mirrors the Angular TenantUser interface. */
public record TeamMemberResponse(
        UUID id,
        String name,
        String email,
        String role,
        boolean active,
        boolean mustRenewPassword) {

    public static TeamMemberResponse from(User user) {
        return new TeamMemberResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole().getCode(),
                user.isActive(),
                user.isMustRenewPassword());
    }
}

package com.erp.erp.settings.dto;

/** Null fields are left unchanged. */
public record UpdateTeamMemberRequest(
        String role, Boolean active, Boolean mustRenewPassword) {}

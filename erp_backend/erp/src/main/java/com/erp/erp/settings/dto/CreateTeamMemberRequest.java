package com.erp.erp.settings.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTeamMemberRequest(
        @NotBlank String name,
        @NotBlank @Email String email,
        @NotBlank String role,
        @NotBlank @Size(min = 8, message = "password must be at least 8 characters")
                String password,
        boolean mustRenewPassword) {}

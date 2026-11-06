package com.erp.erp.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email,

        @NotBlank(message = "code is required")
        @Pattern(regexp = "\\d{6}", message = "code must contain 6 digits")
        String code,

        @NotBlank(message = "newPassword is required")
        @Size(min = 6, max = 72, message = "password must contain 6 to 72 characters")
        String newPassword) {}

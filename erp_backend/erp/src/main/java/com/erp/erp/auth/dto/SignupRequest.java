package com.erp.erp.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;

public record SignupRequest(
        @NotBlank(message = "fullName is required")
        String fullName,

        @NotBlank(message = "companyName is required")
        String companyName,

        @NotBlank(message = "subdomain is required")
        @Pattern(regexp = "^[a-z0-9-]{3,}$", message = "subdomain must be 3+ chars (a-z, 0-9, -)")
        String subdomain,

        @NotBlank(message = "email is required")
        @Email(message = "email must be valid")
        String email,

        @NotBlank(message = "password is required")
        @Size(min = 6, message = "password must be at least 6 characters")
        String password,

        @NotBlank(message = "country is required")
        String country,

        @NotBlank(message = "language is required")
        String language,

        @NotBlank(message = "companySize is required")
        String companySize,

        @NotEmpty(message = "at least one module is required")
        List<String> modules) {}

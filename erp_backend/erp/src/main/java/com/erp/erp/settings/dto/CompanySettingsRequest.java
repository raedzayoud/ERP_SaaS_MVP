package com.erp.erp.settings.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Editable company profile fields. Email, tax id, tenant id, plan and modules are immutable. */
public record CompanySettingsRequest(
        @NotBlank String companyName,
        @NotBlank @Pattern(regexp = "[A-Za-z]{3}", message = "currency must be a 3-letter code")
                String currency,
        String address,
        @NotBlank String country,
        @NotBlank String language,
        @NotBlank String companySize) {}

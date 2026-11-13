package com.erp.erp.crm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LeadRequest(
        @NotBlank @Size(min = 2) String name,
        String company,
        @Email String email,
        String phone,
        @NotBlank String source,
        String notes) {}

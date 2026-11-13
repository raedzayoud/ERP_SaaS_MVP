package com.erp.erp.crm.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PartnerRequest(
        @NotBlank String kind,
        @NotBlank @Size(min = 2) String name,
        String parentId,
        Boolean isCustomer,
        Boolean isSupplier,
        String taxId,
        @NotBlank @Email String email,
        String phone,
        String jobTitle,
        PartnerAddress address,
        String notes) {}

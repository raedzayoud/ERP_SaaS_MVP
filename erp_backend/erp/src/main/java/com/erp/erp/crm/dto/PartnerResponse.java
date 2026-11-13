package com.erp.erp.crm.dto;

import com.erp.erp.crm.model.CrmPartner;
import java.util.Locale;
import java.util.UUID;

public record PartnerResponse(
        UUID id,
        String kind,
        String name,
        String parentId,
        boolean isCustomer,
        boolean isSupplier,
        String taxId,
        String email,
        String phone,
        String jobTitle,
        PartnerAddress address,
        boolean active,
        String notes,
        String createdAt,
        String updatedAt) {

    public static PartnerResponse from(CrmPartner partner) {
        return new PartnerResponse(
                partner.getId(),
                partner.getKind() == null
                        ? null
                        : partner.getKind().name().toLowerCase(Locale.ROOT),
                partner.getName(),
                partner.getParentId() == null ? null : partner.getParentId().toString(),
                partner.isCustomer(),
                partner.isSupplier(),
                partner.getTaxId(),
                partner.getEmail(),
                partner.getPhone(),
                partner.getJobTitle(),
                new PartnerAddress(
                        partner.getAddressStreet(),
                        partner.getAddressCity(),
                        partner.getAddressCountry()),
                partner.isActive(),
                partner.getNotes(),
                partner.getCreatedAt() == null ? null : partner.getCreatedAt().toString(),
                partner.getUpdatedAt() == null ? null : partner.getUpdatedAt().toString());
    }
}

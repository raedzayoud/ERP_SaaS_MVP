package com.erp.erp.crm.dto;

import com.erp.erp.crm.model.CrmLead;
import java.util.Locale;
import java.util.UUID;

public record LeadResponse(
        UUID id,
        String name,
        String company,
        String email,
        String phone,
        String source,
        String status,
        String convertedPartnerId,
        String notes,
        String createdAt,
        String updatedAt) {

    public static LeadResponse from(CrmLead lead) {
        return new LeadResponse(
                lead.getId(),
                lead.getName(),
                lead.getCompany(),
                lead.getEmail(),
                lead.getPhone(),
                lead.getSource() == null ? null : lead.getSource().name().toLowerCase(Locale.ROOT),
                lead.getStatus() == null ? null : lead.getStatus().name().toLowerCase(Locale.ROOT),
                lead.getConvertedPartnerId() == null ? null : lead.getConvertedPartnerId().toString(),
                lead.getNotes(),
                lead.getCreatedAt() == null ? null : lead.getCreatedAt().toString(),
                lead.getUpdatedAt() == null ? null : lead.getUpdatedAt().toString());
    }
}

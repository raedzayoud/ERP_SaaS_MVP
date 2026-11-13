package com.erp.erp.crm.dto;

import com.erp.erp.crm.model.CrmOpportunity;
import java.math.BigDecimal;
import java.util.Locale;
import java.util.UUID;

public record OpportunityResponse(
        UUID id,
        String name,
        String customerId,
        String stage,
        BigDecimal amount,
        String currency,
        String expectedCloseDate,
        String notes,
        String originLeadId,
        String createdAt,
        String updatedAt) {

    public static OpportunityResponse from(CrmOpportunity opportunity) {
        return new OpportunityResponse(
                opportunity.getId(),
                opportunity.getName(),
                opportunity.getCustomerId() == null ? null : opportunity.getCustomerId().toString(),
                opportunity.getStage() == null
                        ? null
                        : opportunity.getStage().name().toLowerCase(Locale.ROOT),
                opportunity.getAmount(),
                opportunity.getCurrency(),
                opportunity.getExpectedCloseDate() == null
                        ? null
                        : opportunity.getExpectedCloseDate().toString(),
                opportunity.getNotes(),
                opportunity.getOriginLeadId() == null ? null : opportunity.getOriginLeadId().toString(),
                opportunity.getCreatedAt() == null ? null : opportunity.getCreatedAt().toString(),
                opportunity.getUpdatedAt() == null ? null : opportunity.getUpdatedAt().toString());
    }
}

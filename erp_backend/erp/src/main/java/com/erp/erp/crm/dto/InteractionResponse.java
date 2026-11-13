package com.erp.erp.crm.dto;

import com.erp.erp.crm.model.CrmInteraction;
import java.util.Locale;
import java.util.UUID;

public record InteractionResponse(
        UUID id,
        String partnerId,
        String type,
        String date,
        String subject,
        String notes,
        String reminderAt,
        boolean reminderDone,
        String createdAt) {

    public static InteractionResponse from(CrmInteraction interaction) {
        return new InteractionResponse(
                interaction.getId(),
                interaction.getPartnerId() == null ? null : interaction.getPartnerId().toString(),
                interaction.getType() == null
                        ? null
                        : interaction.getType().name().toLowerCase(Locale.ROOT),
                interaction.getDate() == null ? null : interaction.getDate().toString(),
                interaction.getSubject(),
                interaction.getNotes(),
                interaction.getReminderAt() == null ? null : interaction.getReminderAt().toString(),
                interaction.isReminderDone(),
                interaction.getCreatedAt() == null ? null : interaction.getCreatedAt().toString());
    }
}

package com.erp.erp.support.dto;

import com.erp.erp.support.model.TicketInteraction;
import java.util.Locale;
import java.util.UUID;

public record InteractionResponse(
        UUID id,
        UUID ticketId,
        String author,
        String channel,
        String message,
        String createdAt) {

    public static InteractionResponse from(TicketInteraction interaction) {
        return new InteractionResponse(
                interaction.getId(),
                interaction.getTicket().getId(),
                interaction.getAuthor(),
                interaction.getChannel() == null
                        ? null
                        : interaction.getChannel().name().toLowerCase(Locale.ROOT),
                interaction.getMessage(),
                interaction.getCreatedAt() == null
                        ? null
                        : interaction.getCreatedAt().toString());
    }
}

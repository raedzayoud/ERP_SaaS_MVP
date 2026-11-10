package com.erp.erp.support.dto;

import com.erp.erp.support.model.SupportTicket;
import java.util.Locale;
import java.util.UUID;

public record SupportTicketResponse(
        UUID id,
        String subject,
        String description,
        String requesterName,
        String requesterEmail,
        String type,
        String priority,
        String status,
        String assignee,
        String createdAt,
        String updatedAt) {

    public static SupportTicketResponse from(SupportTicket ticket) {
        return new SupportTicketResponse(
                ticket.getId(),
                ticket.getSubject(),
                ticket.getDescription(),
                ticket.getRequesterName(),
                ticket.getRequesterEmail(),
                lower(ticket.getType()),
                lower(ticket.getPriority()),
                lower(ticket.getStatus()),
                ticket.getAssignee(),
                ticket.getCreatedAt() == null ? null : ticket.getCreatedAt().toString(),
                ticket.getUpdatedAt() == null ? null : ticket.getUpdatedAt().toString());
    }

    private static String lower(Enum<?> value) {
        return value == null ? null : value.name().toLowerCase(Locale.ROOT);
    }
}

package com.erp.erp.support.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.support.dto.InteractionRequest;
import com.erp.erp.support.dto.InteractionResponse;
import com.erp.erp.support.dto.SupportTicketRequest;
import com.erp.erp.support.dto.SupportTicketResponse;
import com.erp.erp.support.model.InteractionChannel;
import com.erp.erp.support.model.SupportTicket;
import com.erp.erp.support.model.TicketInteraction;
import com.erp.erp.support.model.TicketPriority;
import com.erp.erp.support.model.TicketStatus;
import com.erp.erp.support.model.TicketType;
import com.erp.erp.support.repository.SupportTicketRepository;
import com.erp.erp.support.repository.TicketInteractionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SupportTicketService {

    private final SupportTicketRepository tickets;
    private final TicketInteractionRepository interactions;

    public SupportTicketService(
            SupportTicketRepository tickets, TicketInteractionRepository interactions) {
        this.tickets = tickets;
        this.interactions = interactions;
    }

    @Transactional(readOnly = true)
    public List<SupportTicketResponse> list(
            Tenant tenant, String search, String status, String type) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        TicketStatus statusFilter =
                status == null || status.isBlank() ? null : parseStatus(status);
        TicketType typeFilter = type == null || type.isBlank() ? null : parseType(type);

        return tickets.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(ticket -> statusFilter == null || ticket.getStatus() == statusFilter)
                .filter(ticket -> typeFilter == null || ticket.getType() == typeFilter)
                .filter(ticket -> query.isEmpty() || matches(ticket, query))
                .map(SupportTicketResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public SupportTicketResponse get(Tenant tenant, UUID id) {
        return SupportTicketResponse.from(find(tenant, id));
    }

    @Transactional
    public SupportTicketResponse create(Tenant tenant, SupportTicketRequest request) {
        SupportTicket ticket = new SupportTicket();
        ticket.setTenant(tenant);
        apply(ticket, request);
        return SupportTicketResponse.from(tickets.save(ticket));
    }

    @Transactional
    public SupportTicketResponse update(Tenant tenant, UUID id, SupportTicketRequest request) {
        SupportTicket ticket = find(tenant, id);
        apply(ticket, request);
        ticket.setUpdatedAt(Instant.now());
        return SupportTicketResponse.from(tickets.save(ticket));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        SupportTicket ticket = find(tenant, id);
        interactions.deleteByTenantIdAndTicketId(tenant.getId(), id);
        tickets.delete(ticket);
    }

    @Transactional(readOnly = true)
    public List<InteractionResponse> listInteractions(Tenant tenant, UUID ticketId) {
        find(tenant, ticketId);
        return interactions
                .findByTenantIdAndTicketIdOrderByCreatedAtAsc(tenant.getId(), ticketId)
                .stream()
                .map(InteractionResponse::from)
                .toList();
    }

    @Transactional
    public InteractionResponse addInteraction(
            Tenant tenant, UUID ticketId, InteractionRequest request) {
        SupportTicket ticket = find(tenant, ticketId);

        TicketInteraction interaction = new TicketInteraction();
        interaction.setTenant(tenant);
        interaction.setTicket(ticket);
        interaction.setAuthor(request.author().trim());
        interaction.setChannel(
                request.channel() == null || request.channel().isBlank()
                        ? InteractionChannel.NOTE
                        : parseChannel(request.channel()));
        interaction.setMessage(request.message().trim());

        return InteractionResponse.from(interactions.save(interaction));
    }

    private SupportTicket find(Tenant tenant, UUID id) {
        return tickets
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "ticket not found"));
    }

    private void apply(SupportTicket ticket, SupportTicketRequest request) {
        ticket.setSubject(request.subject().trim());
        ticket.setDescription(request.description().trim());
        ticket.setRequesterName(request.requesterName().trim());
        ticket.setRequesterEmail(request.requesterEmail().trim().toLowerCase(Locale.ROOT));
        if (request.type() != null && !request.type().isBlank()) {
            ticket.setType(parseType(request.type()));
        }
        if (request.priority() != null && !request.priority().isBlank()) {
            ticket.setPriority(parsePriority(request.priority()));
        }
        if (request.status() != null && !request.status().isBlank()) {
            ticket.setStatus(parseStatus(request.status()));
        }
        ticket.setAssignee(request.assignee());
    }

    private boolean matches(SupportTicket ticket, String query) {
        return contains(ticket.getSubject(), query)
                || contains(ticket.getRequesterName(), query)
                || contains(ticket.getRequesterEmail(), query)
                || contains(ticket.getAssignee(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private TicketType parseType(String value) {
        try {
            return TicketType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid ticket type");
        }
    }

    private TicketPriority parsePriority(String value) {
        try {
            return TicketPriority.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid ticket priority");
        }
    }

    private TicketStatus parseStatus(String value) {
        try {
            return TicketStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid ticket status");
        }
    }

    private InteractionChannel parseChannel(String value) {
        try {
            return InteractionChannel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid interaction channel");
        }
    }
}

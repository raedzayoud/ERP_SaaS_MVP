package com.erp.erp.support.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.support.dto.InteractionRequest;
import com.erp.erp.support.dto.InteractionResponse;
import com.erp.erp.support.dto.SupportTicketRequest;
import com.erp.erp.support.dto.SupportTicketResponse;
import com.erp.erp.support.model.InteractionChannel;
import com.erp.erp.support.model.SupportTicket;
import com.erp.erp.support.model.TicketInteraction;
import com.erp.erp.support.repository.SupportTicketRepository;
import com.erp.erp.support.repository.TicketInteractionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SupportTicketServiceTest {

    private final SupportTicketRepository tickets = mock(SupportTicketRepository.class);
    private final TicketInteractionRepository interactions =
            mock(TicketInteractionRepository.class);
    private final SupportTicketService service =
            new SupportTicketService(tickets, interactions);

    @Test
    void createsATicketWithDefaultTypePriorityAndStatus() {
        Tenant tenant = tenant();
        when(tickets.save(any(SupportTicket.class))).thenAnswer(call -> call.getArgument(0));

        SupportTicketResponse response = service.create(
                tenant,
                new SupportTicketRequest(
                        "Cannot log in",
                        "The login page rejects my password.",
                        "Ada Lovelace",
                        "ADA@Example.com",
                        null,
                        null,
                        null,
                        null));

        assertEquals("ticket", response.type());
        assertEquals("medium", response.priority());
        assertEquals("open", response.status());
        assertEquals("ada@example.com", response.requesterEmail());
    }

    @Test
    void deletesInteractionsBeforeTheTicket() {
        Tenant tenant = tenant();
        SupportTicket ticket = ticket(tenant);
        when(tickets.findByIdAndTenantId(ticket.getId(), tenant.getId()))
                .thenReturn(Optional.of(ticket));

        service.delete(tenant, ticket.getId());

        verify(interactions).deleteByTenantIdAndTicketId(tenant.getId(), ticket.getId());
        verify(tickets).delete(ticket);
    }

    @Test
    void doesNotFindATicketFromAnotherTenant() {
        Tenant tenant = tenant();
        UUID id = UUID.randomUUID();
        when(tickets.findByIdAndTenantId(id, tenant.getId())).thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class, () -> service.get(tenant, id));

        assertEquals(404, ex.getStatus());
    }

    @Test
    void addsAnInteractionWithTheDefaultChannel() {
        Tenant tenant = tenant();
        SupportTicket ticket = ticket(tenant);
        when(tickets.findByIdAndTenantId(ticket.getId(), tenant.getId()))
                .thenReturn(Optional.of(ticket));
        when(interactions.save(any(TicketInteraction.class)))
                .thenAnswer(call -> call.getArgument(0));

        InteractionResponse response = service.addInteraction(
                tenant, ticket.getId(), new InteractionRequest("Ada", null, "Looking into it."));

        assertEquals("note", response.channel());
        assertEquals(InteractionChannel.NOTE.name().toLowerCase(), response.channel());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }

    private SupportTicket ticket(Tenant tenant) {
        SupportTicket ticket = new SupportTicket();
        ticket.setId(UUID.randomUUID());
        ticket.setTenant(tenant);
        ticket.setSubject("Cannot log in");
        ticket.setDescription("The login page rejects my password.");
        ticket.setRequesterName("Ada Lovelace");
        ticket.setRequesterEmail("ada@example.com");
        return ticket;
    }
}

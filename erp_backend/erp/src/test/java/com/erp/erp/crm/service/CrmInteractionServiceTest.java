package com.erp.erp.crm.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.InteractionRequest;
import com.erp.erp.crm.dto.InteractionResponse;
import com.erp.erp.crm.model.CrmInteraction;
import com.erp.erp.crm.model.InteractionType;
import com.erp.erp.crm.repository.CrmInteractionRepository;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CrmInteractionServiceTest {

    private final CrmInteractionRepository interactions = mock(CrmInteractionRepository.class);
    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final CrmInteractionService service =
            new CrmInteractionService(interactions, partners);

    @Test
    void addsAnInteractionToAContact() {
        Tenant tenant = tenant();
        UUID partnerId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(partnerId, tenant.getId())).thenReturn(true);
        when(interactions.save(any(CrmInteraction.class))).thenAnswer(call -> call.getArgument(0));

        InteractionResponse response =
                service.add(
                        tenant,
                        partnerId,
                        new InteractionRequest(
                                "call",
                                LocalDate.of(2026, 10, 21),
                                " Follow-up on the add-on ",
                                "They want stamp duty handling.",
                                LocalDate.of(2026, 10, 27)));

        assertEquals("call", response.type());
        assertEquals("Follow-up on the add-on", response.subject());
        assertEquals("2026-10-27", response.reminderAt());
        assertEquals(false, response.reminderDone());
    }

    @Test
    void rejectsAnUnknownContact() {
        Tenant tenant = tenant();
        UUID partnerId = UUID.randomUUID();
        when(partners.existsByIdAndTenantId(partnerId, tenant.getId())).thenReturn(false);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.add(
                                        tenant,
                                        partnerId,
                                        new InteractionRequest(
                                                "call",
                                                LocalDate.of(2026, 10, 21),
                                                "Follow-up",
                                                "",
                                                null)));

        assertEquals(404, ex.getStatus());
        assertEquals("noPartner", ex.getCode());
    }

    @Test
    void marksAReminderAsDone() {
        Tenant tenant = tenant();
        CrmInteraction interaction = interaction(tenant);
        when(interactions.findByIdAndTenantId(interaction.getId(), tenant.getId()))
                .thenReturn(Optional.of(interaction));
        when(interactions.save(any(CrmInteraction.class))).thenAnswer(call -> call.getArgument(0));

        InteractionResponse response =
                service.markReminderDone(tenant, interaction.getId());

        assertEquals(true, response.reminderDone());
    }

    @Test
    void listsOnlyThePendingReminders() {
        Tenant tenant = tenant();
        when(interactions
                        .findByTenantIdAndReminderAtIsNotNullAndReminderDoneFalseOrderByReminderAtAsc(
                                tenant.getId()))
                .thenReturn(List.of(interaction(tenant)));

        List<InteractionResponse> reminders = service.pendingReminders(tenant);

        assertEquals(1, reminders.size());
        assertEquals("Follow-up", reminders.get(0).subject());
    }

    private CrmInteraction interaction(Tenant tenant) {
        CrmInteraction interaction = new CrmInteraction();
        interaction.setId(UUID.randomUUID());
        interaction.setTenant(tenant);
        interaction.setPartnerId(UUID.randomUUID());
        interaction.setType(InteractionType.CALL);
        interaction.setDate(LocalDate.of(2026, 10, 21));
        interaction.setSubject("Follow-up");
        interaction.setReminderAt(LocalDate.of(2026, 10, 27));
        return interaction;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

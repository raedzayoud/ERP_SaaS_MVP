package com.erp.erp.crm.service;

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
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Calls, emails, meetings and notes recorded on a contact. */
@Service
public class CrmInteractionService {

    private final CrmInteractionRepository interactions;
    private final CrmPartnerRepository partners;

    public CrmInteractionService(
            CrmInteractionRepository interactions, CrmPartnerRepository partners) {
        this.interactions = interactions;
        this.partners = partners;
    }

    @Transactional(readOnly = true)
    public List<InteractionResponse> listForPartner(Tenant tenant, UUID partnerId) {
        requirePartner(tenant, partnerId);
        return interactions
                .findByTenantIdAndPartnerIdOrderByDateDesc(tenant.getId(), partnerId)
                .stream()
                .map(InteractionResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<InteractionResponse> pendingReminders(Tenant tenant) {
        return interactions
                .findByTenantIdAndReminderAtIsNotNullAndReminderDoneFalseOrderByReminderAtAsc(
                        tenant.getId())
                .stream()
                .map(InteractionResponse::from)
                .toList();
    }

    @Transactional
    public InteractionResponse add(Tenant tenant, UUID partnerId, InteractionRequest request) {
        requirePartner(tenant, partnerId);
        CrmInteraction interaction = new CrmInteraction();
        interaction.setTenant(tenant);
        interaction.setPartnerId(partnerId);
        interaction.setReminderDone(false);
        apply(interaction, request);
        return InteractionResponse.from(interactions.save(interaction));
    }

    @Transactional
    public InteractionResponse update(Tenant tenant, UUID id, InteractionRequest request) {
        CrmInteraction interaction = find(tenant, id);
        apply(interaction, request);
        return InteractionResponse.from(interactions.save(interaction));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        interactions.delete(find(tenant, id));
    }

    @Transactional
    public InteractionResponse markReminderDone(Tenant tenant, UUID id) {
        CrmInteraction interaction = find(tenant, id);
        interaction.setReminderDone(true);
        return InteractionResponse.from(interactions.save(interaction));
    }

    private CrmInteraction find(Tenant tenant, UUID id) {
        return interactions
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "interaction not found", "notFound"));
    }

    private void requirePartner(Tenant tenant, UUID partnerId) {
        if (!partners.existsByIdAndTenantId(partnerId, tenant.getId())) {
            throw new AuthException(404, "contact not found", "noPartner");
        }
    }

    private void apply(CrmInteraction interaction, InteractionRequest request) {
        interaction.setType(parseType(request.type()));
        interaction.setDate(request.date() == null ? LocalDate.now() : request.date());
        interaction.setSubject(request.subject().trim());
        interaction.setNotes(request.notes() == null ? "" : request.notes().trim());
        interaction.setReminderAt(request.reminderAt());
    }

    private InteractionType parseType(String value) {
        try {
            return InteractionType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid interaction type", "invalidType");
        }
    }
}

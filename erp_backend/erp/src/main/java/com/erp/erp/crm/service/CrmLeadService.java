package com.erp.erp.crm.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.LeadConversionResponse;
import com.erp.erp.crm.dto.LeadRequest;
import com.erp.erp.crm.dto.LeadResponse;
import com.erp.erp.crm.dto.PageResponse;
import com.erp.erp.crm.model.CrmLead;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.model.LeadSource;
import com.erp.erp.crm.model.LeadStatus;
import com.erp.erp.crm.model.PartnerKind;
import com.erp.erp.crm.repository.CrmLeadRepository;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Leads waiting to be contacted, converted into contacts or marked as lost. */
@Service
public class CrmLeadService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 500;

    private final CrmLeadRepository leads;
    private final CrmPartnerRepository partners;

    public CrmLeadService(CrmLeadRepository leads, CrmPartnerRepository partners) {
        this.leads = leads;
        this.partners = partners;
    }

    @Transactional(readOnly = true)
    public PageResponse<LeadResponse> list(
            Tenant tenant, int page, int size, String search, String status, String sort) {
        List<CrmLead> all = leads.findByTenantIdOrderByCreatedAtDesc(tenant.getId());
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        LeadStatus statusFilter = status == null || status.isBlank() ? null : parseStatus(status);
        String order = sort == null || sort.isBlank() ? "createdAt,desc" : sort;

        List<CrmLead> filtered = all.stream()
                .filter(lead -> statusFilter == null || lead.getStatus() == statusFilter)
                .filter(lead -> query.isEmpty() || matches(lead, query))
                .sorted(comparator(order))
                .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int currentPage = Math.max(0, page);
        int from = Math.min(currentPage * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());

        List<LeadResponse> items = filtered.subList(from, to).stream()
                .map(LeadResponse::from)
                .toList();

        return new PageResponse<>(items, filtered.size(), currentPage, pageSize);
    }

    @Transactional(readOnly = true)
    public LeadResponse get(Tenant tenant, UUID id) {
        return LeadResponse.from(find(tenant, id));
    }

    @Transactional
    public LeadResponse create(Tenant tenant, LeadRequest request) {
        CrmLead lead = new CrmLead();
        lead.setTenant(tenant);
        lead.setStatus(LeadStatus.NEW);
        apply(lead, request);
        return LeadResponse.from(leads.save(lead));
    }

    @Transactional
    public LeadResponse update(Tenant tenant, UUID id, LeadRequest request) {
        CrmLead lead = find(tenant, id);
        apply(lead, request);
        lead.setUpdatedAt(Instant.now());
        return LeadResponse.from(leads.save(lead));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        leads.delete(find(tenant, id));
    }

    @Transactional
    public LeadResponse lose(Tenant tenant, UUID id) {
        CrmLead lead = find(tenant, id);
        if (lead.getStatus() == LeadStatus.CONVERTED) {
            throw new AuthException(409, "lead already converted", "alreadyConverted");
        }
        lead.setStatus(LeadStatus.LOST);
        lead.setUpdatedAt(Instant.now());
        return LeadResponse.from(leads.save(lead));
    }

    /** Turns the lead into a contact and keeps the link on the lead. */
    @Transactional
    public LeadConversionResponse convert(Tenant tenant, UUID id) {
        CrmLead lead = find(tenant, id);
        if (lead.getStatus() == LeadStatus.CONVERTED) {
            throw new AuthException(409, "lead already converted", "alreadyConverted");
        }
        if (lead.getStatus() == LeadStatus.LOST) {
            throw new AuthException(409, "lost lead cannot be converted", "lostLead");
        }

        boolean company = lead.getCompany() != null && !lead.getCompany().isBlank();
        CrmPartner partner = new CrmPartner();
        partner.setTenant(tenant);
        partner.setActive(true);
        partner.setKind(company ? PartnerKind.COMPANY : PartnerKind.PERSON);
        partner.setName(company ? lead.getCompany() : lead.getName());
        partner.setCustomer(true);
        partner.setSupplier(false);
        partner.setTaxId("");
        partner.setEmail(lead.getEmail());
        partner.setPhone(lead.getPhone());
        partner.setJobTitle(company ? "" : "Customer");
        partner.setAddressStreet("");
        partner.setAddressCity("");
        partner.setAddressCountry("");
        partner.setNotes(("Converted from lead \"" + lead.getName() + "\". " + lead.getNotes()).trim());
        CrmPartner saved = partners.save(partner);

        lead.setStatus(LeadStatus.CONVERTED);
        lead.setConvertedPartnerId(saved.getId());
        lead.setUpdatedAt(Instant.now());
        CrmLead savedLead = leads.save(lead);

        return new LeadConversionResponse(saved.getId().toString(), LeadResponse.from(savedLead));
    }

    private CrmLead find(Tenant tenant, UUID id) {
        return leads
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "lead not found", "notFound"));
    }

    private void apply(CrmLead lead, LeadRequest request) {
        lead.setName(request.name().trim());
        lead.setCompany(trim(request.company()));
        lead.setEmail(trim(request.email()).toLowerCase(Locale.ROOT));
        lead.setPhone(trim(request.phone()));
        lead.setSource(parseSource(request.source()));
        lead.setNotes(trim(request.notes()));
    }

    private boolean matches(CrmLead lead, String query) {
        return contains(lead.getName(), query)
                || contains(lead.getCompany(), query)
                || contains(lead.getEmail(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private Comparator<CrmLead> comparator(String sort) {
        String[] parts = sort == null ? new String[0] : sort.split(",");
        String field = parts.length > 0 ? parts[0].trim() : "createdAt";
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());

        Comparator<CrmLead> comparator =
                "name".equalsIgnoreCase(field)
                        ? Comparator.comparing(
                                CrmLead::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        : Comparator.comparing(
                                CrmLead::getCreatedAt,
                                Comparator.nullsLast(Comparator.<Instant>naturalOrder()));
        return desc ? comparator.reversed() : comparator;
    }

    private LeadSource parseSource(String value) {
        try {
            return LeadSource.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid lead source", "invalidSource");
        }
    }

    private LeadStatus parseStatus(String value) {
        try {
            return LeadStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid lead status", "invalidStatus");
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}

package com.erp.erp.crm.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.crm.dto.PartnerAddress;
import com.erp.erp.crm.dto.PartnerRequest;
import com.erp.erp.crm.dto.PartnerResponse;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.model.PartnerKind;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Customers and suppliers; the frontend calls them contacts. */
@Service
public class CrmPartnerService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 500;

    private final CrmPartnerRepository partners;

    public CrmPartnerService(CrmPartnerRepository partners) {
        this.partners = partners;
    }

    @Transactional(readOnly = true)
    public PageResponse<PartnerResponse> list(
            Tenant tenant,
            int page,
            int size,
            String search,
            String kind,
            Boolean active,
            String sort) {
        List<CrmPartner> all = partners.findByTenantIdOrderByNameAsc(tenant.getId());
        Map<UUID, String> names = all.stream()
                .collect(Collectors.toMap(CrmPartner::getId, CrmPartner::getName, (a, b) -> a));

        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        PartnerKind kindFilter = kind == null || kind.isBlank() ? null : parseKind(kind);

        List<CrmPartner> filtered = all.stream()
                .filter(partner -> kindFilter == null || partner.getKind() == kindFilter)
                .filter(partner -> active == null || partner.isActive() == active)
                .filter(partner -> query.isEmpty() || matches(partner, query, names))
                .sorted(comparator(sort))
                .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int currentPage = Math.max(0, page);
        int from = Math.min(currentPage * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());

        List<PartnerResponse> items = filtered.subList(from, to).stream()
                .map(PartnerResponse::from)
                .toList();

        return new PageResponse<>(items, filtered.size(), currentPage, pageSize);
    }

    @Transactional(readOnly = true)
    public PartnerResponse get(Tenant tenant, UUID id) {
        return PartnerResponse.from(find(tenant, id));
    }

    @Transactional
    public PartnerResponse create(Tenant tenant, PartnerRequest request) {
        CrmPartner partner = new CrmPartner();
        partner.setTenant(tenant);
        partner.setActive(true);
        apply(partner, request, tenant);
        guardDuplicate(partner, null);
        return PartnerResponse.from(partners.save(partner));
    }

    @Transactional
    public PartnerResponse update(Tenant tenant, UUID id, PartnerRequest request) {
        CrmPartner partner = find(tenant, id);
        apply(partner, request, tenant);
        guardDuplicate(partner, id);
        partner.setUpdatedAt(Instant.now());
        return PartnerResponse.from(partners.save(partner));
    }

    @Transactional
    public PartnerResponse archive(Tenant tenant, UUID id) {
        CrmPartner partner = find(tenant, id);
        partner.setActive(false);
        partner.setUpdatedAt(Instant.now());
        return PartnerResponse.from(partners.save(partner));
    }

    @Transactional
    public PartnerResponse restore(Tenant tenant, UUID id) {
        CrmPartner partner = find(tenant, id);
        partner.setActive(true);
        partner.setUpdatedAt(Instant.now());
        return PartnerResponse.from(partners.save(partner));
    }

    private CrmPartner find(Tenant tenant, UUID id) {
        return partners
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "contact not found", "notFound"));
    }

    private void apply(CrmPartner partner, PartnerRequest request, Tenant tenant) {
        partner.setKind(parseKind(request.kind()));
        partner.setName(request.name().trim());
        partner.setParentId(parentId(request.parentId(), tenant, partner.getId()));
        partner.setCustomer(Boolean.TRUE.equals(request.isCustomer()));
        partner.setSupplier(Boolean.TRUE.equals(request.isSupplier()));
        partner.setTaxId(trim(request.taxId()));
        partner.setEmail(trim(request.email()).toLowerCase(Locale.ROOT));
        if (partner.getEmail().isBlank()) {
            throw new AuthException(400, "an email is required", "noEmail");
        }
        partner.setPhone(trim(request.phone()));
        partner.setJobTitle(trim(request.jobTitle()));

        PartnerAddress address =
                request.address() == null ? new PartnerAddress("", "", "") : request.address();
        partner.setAddressStreet(trim(address.street()));
        partner.setAddressCity(trim(address.city()));
        partner.setAddressCountry(trim(address.country()));
        partner.setNotes(trim(request.notes()));
    }

    private UUID parentId(String value, Tenant tenant, UUID self) {
        if (value == null || value.isBlank()) {
            return null;
        }
        UUID id = uuid(value);
        if (id.equals(self)) {
            throw new AuthException(400, "a contact cannot be its own company", "invalidParent");
        }
        if (!partners.existsByIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(404, "parent contact not found", "notFound");
        }
        return id;
    }

    /** Refuses a second contact with the same email or tax number in this workspace. */
    private void guardDuplicate(CrmPartner partner, UUID currentId) {
        UUID tenantId = partner.getTenant().getId();
        String email = partner.getEmail();
        String taxId = partner.getTaxId();

        if (!email.isBlank()) {
            boolean exists =
                    currentId == null
                            ? partners.existsByTenantIdAndEmailIgnoreCase(tenantId, email)
                            : partners.existsByTenantIdAndEmailIgnoreCaseAndIdNot(
                                    tenantId, email, currentId);
            if (exists) {
                throw new AuthException(
                        409, "a contact with this email already exists", "duplicateContact");
            }
        }

        if (!taxId.isBlank()) {
            boolean exists =
                    currentId == null
                            ? partners.existsByTenantIdAndTaxIdIgnoreCase(tenantId, taxId)
                            : partners.existsByTenantIdAndTaxIdIgnoreCaseAndIdNot(
                                    tenantId, taxId, currentId);
            if (exists) {
                throw new AuthException(
                        409, "a contact with this tax number already exists", "duplicateContact");
            }
        }
    }

    private boolean matches(CrmPartner partner, String query, Map<UUID, String> names) {
        String parentName =
                partner.getParentId() == null ? "" : names.getOrDefault(partner.getParentId(), "");
        return contains(partner.getName(), query)
                || contains(partner.getEmail(), query)
                || contains(partner.getPhone(), query)
                || contains(partner.getTaxId(), query)
                || contains(partner.getJobTitle(), query)
                || contains(partner.getAddressCity(), query)
                || contains(partner.getAddressStreet(), query)
                || contains(parentName, query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private Comparator<CrmPartner> comparator(String sort) {
        String[] parts = sort == null ? new String[0] : sort.split(",");
        String field = parts.length > 0 ? parts[0].trim() : "name";
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim());

        Comparator<CrmPartner> comparator =
                "createdat".equalsIgnoreCase(field)
                        ? Comparator.comparing(
                                CrmPartner::getCreatedAt,
                                Comparator.nullsLast(Comparator.<Instant>naturalOrder()))
                        : Comparator.comparing(
                                CrmPartner::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER));
        return desc ? comparator.reversed() : comparator;
    }

    private PartnerKind parseKind(String value) {
        try {
            return PartnerKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid contact kind", "invalidKind");
        }
    }

    private UUID uuid(String value) {
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid contact id", "notFound");
        }
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }
}

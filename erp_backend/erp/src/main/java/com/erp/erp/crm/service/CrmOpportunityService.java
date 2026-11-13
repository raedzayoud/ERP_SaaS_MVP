package com.erp.erp.crm.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.dto.OpportunityRequest;
import com.erp.erp.crm.dto.OpportunityResponse;
import com.erp.erp.crm.model.CrmOpportunity;
import com.erp.erp.crm.model.OpportunityStage;
import com.erp.erp.crm.repository.CrmOpportunityRepository;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deals of the sales pipeline; won and lost stages are final. */
@Service
public class CrmOpportunityService {

    private final CrmOpportunityRepository opportunities;
    private final CrmPartnerRepository partners;

    public CrmOpportunityService(
            CrmOpportunityRepository opportunities, CrmPartnerRepository partners) {
        this.opportunities = opportunities;
        this.partners = partners;
    }

    @Transactional(readOnly = true)
    public List<OpportunityResponse> list(Tenant tenant) {
        return opportunities.findByTenantIdOrderByUpdatedAtDesc(tenant.getId()).stream()
                .map(OpportunityResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public OpportunityResponse get(Tenant tenant, UUID id) {
        return OpportunityResponse.from(find(tenant, id));
    }

    @Transactional
    public OpportunityResponse create(Tenant tenant, OpportunityRequest request) {
        CrmOpportunity opportunity = new CrmOpportunity();
        opportunity.setTenant(tenant);
        opportunity.setOriginLeadId(null);
        opportunity.setCurrency(currency(request.currency(), tenant));
        apply(opportunity, request, tenant);
        return OpportunityResponse.from(opportunities.save(opportunity));
    }

    @Transactional
    public OpportunityResponse update(Tenant tenant, UUID id, OpportunityRequest request) {
        CrmOpportunity opportunity = find(tenant, id);
        if (isClosed(opportunity.getStage())) {
            throw new AuthException(409, "closed opportunity cannot be changed", "stageClosed");
        }
        apply(opportunity, request, tenant);
        opportunity.setUpdatedAt(Instant.now());
        return OpportunityResponse.from(opportunities.save(opportunity));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        opportunities.delete(find(tenant, id));
    }

    @Transactional
    public OpportunityResponse updateStage(Tenant tenant, UUID id, String stage) {
        CrmOpportunity opportunity = find(tenant, id);
        if (isClosed(opportunity.getStage())) {
            throw new AuthException(409, "closed opportunity cannot change stage", "stageClosed");
        }
        opportunity.setStage(parseStage(stage));
        opportunity.setUpdatedAt(Instant.now());
        return OpportunityResponse.from(opportunities.save(opportunity));
    }

    private CrmOpportunity find(Tenant tenant, UUID id) {
        return opportunities
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "opportunity not found", "notFound"));
    }

    private void apply(CrmOpportunity opportunity, OpportunityRequest request, Tenant tenant) {
        opportunity.setName(request.name().trim());
        opportunity.setCustomerId(customerId(request.customerId(), tenant));
        opportunity.setStage(parseStage(request.stage()));
        opportunity.setAmount(amount(request.amount()));
        opportunity.setExpectedCloseDate(request.expectedCloseDate());
        opportunity.setNotes(request.notes() == null ? "" : request.notes().trim());
    }

    private UUID customerId(String value, Tenant tenant) {
        if (value == null || value.isBlank()) {
            throw new AuthException(400, "a customer is required", "noCustomer");
        }
        UUID id;
        try {
            id = UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "a customer is required", "noCustomer");
        }
        if (!partners.existsByIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(400, "a customer is required", "noCustomer");
        }
        return id;
    }

    private BigDecimal amount(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) <= 0) {
            throw new AuthException(400, "amount must be greater than zero", "invalidAmount");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String currency(String value, Tenant tenant) {
        if (value == null || value.isBlank()) {
            return tenant.getCurrency() == null || tenant.getCurrency().isBlank()
                    ? "USD"
                    : tenant.getCurrency().toUpperCase(Locale.ROOT);
        }
        return value.trim().toUpperCase(Locale.ROOT);
    }

    private boolean isClosed(OpportunityStage stage) {
        return stage == OpportunityStage.WON || stage == OpportunityStage.LOST;
    }

    private OpportunityStage parseStage(String value) {
        if (value == null || value.isBlank()) {
            throw new AuthException(400, "invalid pipeline stage", "invalidStage");
        }
        try {
            return OpportunityStage.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid pipeline stage", "invalidStage");
        }
    }
}

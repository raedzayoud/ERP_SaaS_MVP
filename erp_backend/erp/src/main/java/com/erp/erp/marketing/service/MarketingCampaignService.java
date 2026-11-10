package com.erp.erp.marketing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.CampaignRequest;
import com.erp.erp.marketing.dto.CampaignResponse;
import com.erp.erp.marketing.model.CampaignChannel;
import com.erp.erp.marketing.model.MarketingCampaign;
import com.erp.erp.marketing.repository.MarketingCampaignRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MarketingCampaignService {

    private final MarketingCampaignRepository campaigns;
    private final MarketingPromotionRepository promotions;

    public MarketingCampaignService(
            MarketingCampaignRepository campaigns, MarketingPromotionRepository promotions) {
        this.campaigns = campaigns;
        this.promotions = promotions;
    }

    @Transactional(readOnly = true)
    public List<CampaignResponse> list(Tenant tenant, String search, Boolean active) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);

        return campaigns.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(campaign -> active == null || campaign.isActive() == active)
                .filter(campaign -> query.isEmpty() || matches(campaign, query))
                .map(CampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CampaignResponse get(Tenant tenant, UUID id) {
        return CampaignResponse.from(find(tenant, id));
    }

    @Transactional
    public CampaignResponse create(Tenant tenant, CampaignRequest request) {
        MarketingCampaign campaign = new MarketingCampaign();
        campaign.setTenant(tenant);
        apply(tenant, campaign, request);
        return CampaignResponse.from(campaigns.save(campaign));
    }

    @Transactional
    public CampaignResponse update(Tenant tenant, UUID id, CampaignRequest request) {
        MarketingCampaign campaign = find(tenant, id);
        apply(tenant, campaign, request);
        campaign.setUpdatedAt(Instant.now());
        return CampaignResponse.from(campaigns.save(campaign));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        MarketingCampaign campaign = find(tenant, id);
        if (promotions.existsByCampaignIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(409, "campaign has promotions");
        }
        campaigns.delete(campaign);
    }

    private MarketingCampaign find(Tenant tenant, UUID id) {
        return campaigns
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "campaign not found"));
    }

    private void apply(Tenant tenant, MarketingCampaign campaign, CampaignRequest request) {
        validateDates(request.startDate(), request.endDate());
        String currency = request.currency().trim().toUpperCase(Locale.ROOT);
        if (tenant.getCurrency() != null && !tenant.getCurrency().equalsIgnoreCase(currency)) {
            throw new AuthException(400, "currency must match workspace currency");
        }

        campaign.setName(request.name().trim());
        campaign.setDescription(request.description());
        campaign.setChannel(parseChannel(request.channel()));
        campaign.setStartDate(request.startDate());
        campaign.setEndDate(request.endDate());
        campaign.setBudget(request.budget());
        campaign.setCurrency(currency);
        campaign.setActive(request.active());
    }

    private void validateDates(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new AuthException(400, "end date must not be before start date");
        }
    }

    private CampaignChannel parseChannel(String value) {
        try {
            return CampaignChannel.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid campaign channel");
        }
    }

    private boolean matches(MarketingCampaign campaign, String query) {
        return contains(campaign.getName(), query)
                || contains(campaign.getDescription(), query)
                || contains(campaign.getChannel() == null ? null : campaign.getChannel().name(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}

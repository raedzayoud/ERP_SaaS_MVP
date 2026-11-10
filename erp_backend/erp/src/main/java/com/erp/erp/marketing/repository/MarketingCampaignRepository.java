package com.erp.erp.marketing.repository;

import com.erp.erp.marketing.model.MarketingCampaign;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketingCampaignRepository extends JpaRepository<MarketingCampaign, UUID> {

    List<MarketingCampaign> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<MarketingCampaign> findByIdAndTenantId(UUID id, UUID tenantId);
}

package com.erp.erp.marketing.repository;

import com.erp.erp.marketing.model.MarketingPromotion;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MarketingPromotionRepository extends JpaRepository<MarketingPromotion, UUID> {

    List<MarketingPromotion> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    List<MarketingPromotion> findByTenantIdAndActiveTrueOrderByCreatedAtDesc(UUID tenantId);

    Optional<MarketingPromotion> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByCampaignIdAndTenantId(UUID campaignId, UUID tenantId);

    boolean existsBySegmentIdAndTenantId(UUID segmentId, UUID tenantId);
}

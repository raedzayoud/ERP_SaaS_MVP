package com.erp.erp.crm.repository;

import com.erp.erp.crm.model.CrmOpportunity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrmOpportunityRepository extends JpaRepository<CrmOpportunity, UUID> {
    List<CrmOpportunity> findByTenantIdOrderByUpdatedAtDesc(UUID tenantId);

    Optional<CrmOpportunity> findByIdAndTenantId(UUID id, UUID tenantId);
}

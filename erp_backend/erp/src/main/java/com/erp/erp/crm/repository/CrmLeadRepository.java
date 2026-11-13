package com.erp.erp.crm.repository;

import com.erp.erp.crm.model.CrmLead;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrmLeadRepository extends JpaRepository<CrmLead, UUID> {
    List<CrmLead> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<CrmLead> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndEmailIgnoreCase(UUID tenantId, String email);

    boolean existsByTenantIdAndNameIgnoreCaseAndCompanyIgnoreCase(
            UUID tenantId, String name, String company);

    boolean existsByTenantIdAndEmailIgnoreCaseAndIdNot(UUID tenantId, String email, UUID id);

    boolean existsByTenantIdAndNameIgnoreCaseAndCompanyIgnoreCaseAndIdNot(
            UUID tenantId, String name, String company, UUID id);
}

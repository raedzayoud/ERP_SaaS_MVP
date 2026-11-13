package com.erp.erp.crm.repository;

import com.erp.erp.crm.model.CrmPartner;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrmPartnerRepository extends JpaRepository<CrmPartner, UUID> {
    List<CrmPartner> findByTenantIdOrderByNameAsc(UUID tenantId);

    Optional<CrmPartner> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndEmailIgnoreCase(UUID tenantId, String email);

    boolean existsByTenantIdAndTaxIdIgnoreCase(UUID tenantId, String taxId);

    boolean existsByTenantIdAndEmailIgnoreCaseAndIdNot(UUID tenantId, String email, UUID id);

    boolean existsByTenantIdAndTaxIdIgnoreCaseAndIdNot(UUID tenantId, String taxId, UUID id);
}

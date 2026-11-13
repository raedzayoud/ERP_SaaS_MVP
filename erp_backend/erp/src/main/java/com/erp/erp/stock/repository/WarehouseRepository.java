package com.erp.erp.stock.repository;

import com.erp.erp.stock.model.Warehouse;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WarehouseRepository extends JpaRepository<Warehouse, UUID> {
    List<Warehouse> findByTenantIdOrderByCodeAsc(UUID tenantId);

    Optional<Warehouse> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndCodeIgnoreCase(UUID tenantId, String code);

    boolean existsByTenantIdAndCodeIgnoreCaseAndIdNot(UUID tenantId, String code, UUID id);

    long countByTenantIdAndActiveTrue(UUID tenantId);
}

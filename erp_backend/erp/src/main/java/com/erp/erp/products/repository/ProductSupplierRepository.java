package com.erp.erp.products.repository;

import com.erp.erp.products.model.ProductSupplier;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductSupplierRepository extends JpaRepository<ProductSupplier, UUID> {
    List<ProductSupplier> findByTenantIdAndProductIdOrderByPositionAsc(UUID tenantId, UUID productId);

    List<ProductSupplier> findByTenantIdAndProductIdInOrderByPositionAsc(
            UUID tenantId, List<UUID> productIds);

    List<ProductSupplier> findByTenantIdAndSupplierId(UUID tenantId, UUID supplierId);

    void deleteByTenantIdAndProductId(UUID tenantId, UUID productId);
}

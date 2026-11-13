package com.erp.erp.products.repository;

import com.erp.erp.products.model.Product;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    List<Product> findByTenantIdOrderByNameAsc(UUID tenantId);

    Optional<Product> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndSkuIgnoreCase(UUID tenantId, String sku);

    boolean existsByTenantIdAndSkuIgnoreCaseAndIdNot(UUID tenantId, String sku, UUID id);
}

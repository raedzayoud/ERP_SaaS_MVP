package com.erp.erp.purchases.repository;

import com.erp.erp.purchases.model.PurchaseOrder;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, UUID> {

    List<PurchaseOrder> findByTenantIdOrderByOrderDateDesc(UUID tenantId);

    Optional<PurchaseOrder> findByIdAndTenantId(UUID id, UUID tenantId);

    /** The confirmed orders of a tenant for one year, used to number the next one. */
    List<PurchaseOrder> findByTenantIdAndNumberStartingWith(UUID tenantId, String prefix);
}

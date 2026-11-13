package com.erp.erp.stock.repository;

import com.erp.erp.stock.model.StockMovement;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockMovementRepository extends JpaRepository<StockMovement, UUID> {
    List<StockMovement> findByTenantIdOrderByDateDescCreatedAtDesc(UUID tenantId);
}

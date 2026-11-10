package com.erp.erp.marketing.repository;

import com.erp.erp.marketing.model.CustomerSegment;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerSegmentRepository extends JpaRepository<CustomerSegment, UUID> {

    List<CustomerSegment> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<CustomerSegment> findByIdAndTenantId(UUID id, UUID tenantId);
}

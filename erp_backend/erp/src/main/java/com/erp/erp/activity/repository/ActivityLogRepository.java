package com.erp.erp.activity.repository;

import com.erp.erp.activity.model.ActivityLog;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {

    List<ActivityLog> findByTenantIdOrderByCreatedAtDesc(UUID tenantId, Pageable pageable);
}

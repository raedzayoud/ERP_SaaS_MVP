package com.erp.erp.hr.repository;

import com.erp.erp.hr.model.LeaveRequest;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID> {

    List<LeaveRequest> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<LeaveRequest> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByEmployeeIdAndTenantId(UUID employeeId, UUID tenantId);
}

package com.erp.erp.hr.repository;

import com.erp.erp.hr.model.Employee;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    List<Employee> findByTenantIdOrderByFullNameAsc(UUID tenantId);

    Optional<Employee> findByIdAndTenantId(UUID id, UUID tenantId);
}

package com.erp.erp.tenant.repository;

import com.erp.erp.tenant.model.Tenant;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findBySubdomain(String subdomain);

    boolean existsBySubdomain(String subdomain);

    boolean existsByEmail(String email);
}

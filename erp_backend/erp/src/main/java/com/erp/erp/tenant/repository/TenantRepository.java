package com.erp.erp.tenant.repository;

import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Optional<Tenant> findBySubdomain(String subdomain);

    List<Tenant> findByKycStatusOrderByCreatedAtDesc(KycStatus kycStatus);

    boolean existsBySubdomain(String subdomain);

    boolean existsByEmail(String email);
}

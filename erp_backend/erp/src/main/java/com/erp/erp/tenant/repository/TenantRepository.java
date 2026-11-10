package com.erp.erp.tenant.repository;

import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    /** Serializes trial-connection consumption for one tenant. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Tenant t where t.id = :id")
    Optional<Tenant> findByIdForUpdate(@Param("id") UUID id);

    Optional<Tenant> findBySubdomain(String subdomain);

    Optional<Tenant> findByStripeCustomerId(String stripeCustomerId);

    Optional<Tenant> findByStripeSubscriptionId(String stripeSubscriptionId);

    List<Tenant> findByKycStatusOrderByCreatedAtDesc(KycStatus kycStatus);

    List<Tenant> findByKycStatusNotOrderByCreatedAtDesc(KycStatus kycStatus);

    List<Tenant> findTop5ByKycStatusNotOrderByCreatedAtDesc(KycStatus kycStatus);

    List<Tenant> findByBillingStatus(BillingStatus billingStatus);

    List<Tenant> findByTenantStatus(TenantStatus tenantStatus);

    long countByKycStatus(KycStatus kycStatus);

    long countByKycStatusNot(KycStatus kycStatus);

    long countByTenantStatus(TenantStatus tenantStatus);

    boolean existsBySubdomain(String subdomain);

    boolean existsByEmail(String email);
}

package com.erp.erp.user.repository;

import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    /** The tenant is fetched with the user: callers use it outside a transaction. */
    @EntityGraph(attributePaths = "tenant")
    Optional<User> findByEmail(String email);

    Optional<User> findFirstByTenantId(UUID tenantId);

    List<User> findByTenantIdOrderByFullNameAsc(UUID tenantId);

    Optional<User> findByIdAndTenantId(UUID id, UUID tenantId);

    long countByTenantIdAndRole(UUID tenantId, Role role);

    long countByTenantId(UUID tenantId);

    long countByTenantIsNotNull();

    boolean existsByEmail(String email);
}

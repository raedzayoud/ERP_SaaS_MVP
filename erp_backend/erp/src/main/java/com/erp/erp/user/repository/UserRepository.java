package com.erp.erp.user.repository;

import com.erp.erp.user.model.User;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmail(String email);

    Optional<User> findFirstByTenantId(UUID tenantId);

    boolean existsByEmail(String email);
}

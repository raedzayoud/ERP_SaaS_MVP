package com.erp.erp.support.repository;

import com.erp.erp.support.model.SupportTicket;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportTicketRepository extends JpaRepository<SupportTicket, UUID> {

    List<SupportTicket> findByTenantIdOrderByCreatedAtDesc(UUID tenantId);

    Optional<SupportTicket> findByIdAndTenantId(UUID id, UUID tenantId);
}

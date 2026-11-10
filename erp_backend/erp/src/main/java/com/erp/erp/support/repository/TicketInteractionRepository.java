package com.erp.erp.support.repository;

import com.erp.erp.support.model.TicketInteraction;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TicketInteractionRepository extends JpaRepository<TicketInteraction, UUID> {

    List<TicketInteraction> findByTenantIdAndTicketIdOrderByCreatedAtAsc(
            UUID tenantId, UUID ticketId);

    void deleteByTenantIdAndTicketId(UUID tenantId, UUID ticketId);
}

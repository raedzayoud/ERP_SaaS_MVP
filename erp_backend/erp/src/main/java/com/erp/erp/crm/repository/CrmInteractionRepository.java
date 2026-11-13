package com.erp.erp.crm.repository;

import com.erp.erp.crm.model.CrmInteraction;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CrmInteractionRepository extends JpaRepository<CrmInteraction, UUID> {
    List<CrmInteraction> findByTenantIdAndPartnerIdOrderByDateDesc(UUID tenantId, UUID partnerId);

    List<CrmInteraction> findByTenantIdAndReminderAtIsNotNullAndReminderDoneFalseOrderByReminderAtAsc(
            UUID tenantId);

    Optional<CrmInteraction> findByIdAndTenantId(UUID id, UUID tenantId);
}

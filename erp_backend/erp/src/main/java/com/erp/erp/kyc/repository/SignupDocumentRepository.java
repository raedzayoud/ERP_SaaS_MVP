package com.erp.erp.kyc.repository;

import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SignupDocumentRepository extends JpaRepository<SignupDocument, UUID> {

    List<SignupDocument> findByTenantId(UUID tenantId);

    Optional<SignupDocument> findByIdAndTenant_Id(UUID id, UUID tenantId);

    Optional<SignupDocument> findByTenantIdAndSlot(UUID tenantId, DocumentSlot slot);
}

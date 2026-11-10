package com.erp.erp.support.repository;

import com.erp.erp.support.model.KnowledgeArticle;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeArticleRepository extends JpaRepository<KnowledgeArticle, UUID> {

    List<KnowledgeArticle> findByTenantIdOrderByUpdatedAtDesc(UUID tenantId);

    Optional<KnowledgeArticle> findByIdAndTenantId(UUID id, UUID tenantId);
}

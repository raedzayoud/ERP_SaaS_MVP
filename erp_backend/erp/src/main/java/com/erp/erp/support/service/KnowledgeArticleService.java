package com.erp.erp.support.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.support.dto.KnowledgeArticleRequest;
import com.erp.erp.support.dto.KnowledgeArticleResponse;
import com.erp.erp.support.model.KnowledgeArticle;
import com.erp.erp.support.repository.KnowledgeArticleRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KnowledgeArticleService {

    private final KnowledgeArticleRepository articles;

    public KnowledgeArticleService(KnowledgeArticleRepository articles) {
        this.articles = articles;
    }

    @Transactional(readOnly = true)
    public List<KnowledgeArticleResponse> list(Tenant tenant) {
        return articles.findByTenantIdOrderByUpdatedAtDesc(tenant.getId()).stream()
                .map(KnowledgeArticleResponse::from)
                .toList();
    }

    @Transactional
    public KnowledgeArticleResponse create(Tenant tenant, KnowledgeArticleRequest request) {
        KnowledgeArticle article = new KnowledgeArticle();
        article.setTenant(tenant);
        apply(article, request);
        return KnowledgeArticleResponse.from(articles.save(article));
    }

    @Transactional
    public KnowledgeArticleResponse update(
            Tenant tenant, UUID id, KnowledgeArticleRequest request) {
        KnowledgeArticle article = find(tenant, id);
        apply(article, request);
        article.setUpdatedAt(Instant.now());
        return KnowledgeArticleResponse.from(articles.save(article));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        articles.delete(find(tenant, id));
    }

    private KnowledgeArticle find(Tenant tenant, UUID id) {
        return articles
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "article not found"));
    }

    private void apply(KnowledgeArticle article, KnowledgeArticleRequest request) {
        article.setTitle(request.title().trim());
        article.setCategory(request.category().trim());
        article.setBody(request.body().trim());
        if (request.published() != null) {
            article.setPublished(request.published());
        }
    }
}

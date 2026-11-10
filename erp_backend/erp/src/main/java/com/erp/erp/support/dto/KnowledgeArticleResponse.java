package com.erp.erp.support.dto;

import com.erp.erp.support.model.KnowledgeArticle;
import java.util.UUID;

public record KnowledgeArticleResponse(
        UUID id,
        String title,
        String category,
        String body,
        boolean published,
        String createdAt,
        String updatedAt) {

    public static KnowledgeArticleResponse from(KnowledgeArticle article) {
        return new KnowledgeArticleResponse(
                article.getId(),
                article.getTitle(),
                article.getCategory(),
                article.getBody(),
                article.isPublished(),
                article.getCreatedAt() == null ? null : article.getCreatedAt().toString(),
                article.getUpdatedAt() == null ? null : article.getUpdatedAt().toString());
    }
}

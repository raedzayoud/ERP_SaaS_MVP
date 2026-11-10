package com.erp.erp.support.dto;

import jakarta.validation.constraints.NotBlank;

public record KnowledgeArticleRequest(
        @NotBlank String title,
        @NotBlank String category,
        @NotBlank String body,
        Boolean published) {}

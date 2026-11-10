package com.erp.erp.support.dto;

import jakarta.validation.constraints.NotBlank;

public record InteractionRequest(
        @NotBlank String author,
        String channel,
        @NotBlank String message) {}

package com.erp.erp.kyc.dto;

import java.util.UUID;

public record SignupDocumentResponse(
        UUID id,
        String slot,
        String fileName,
        String contentType,
        long sizeKb,
        String uploadedAt,
        String downloadUrl) {}

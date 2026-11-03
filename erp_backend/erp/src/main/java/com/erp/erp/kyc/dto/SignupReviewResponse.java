package com.erp.erp.kyc.dto;

import com.erp.erp.auth.dto.TenantResponse;
import java.util.List;

public record SignupReviewResponse(
        TenantResponse tenant,
        String applicantName,
        List<SignupDocumentResponse> documents) {}

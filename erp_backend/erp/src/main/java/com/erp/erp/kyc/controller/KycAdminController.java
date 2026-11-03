package com.erp.erp.kyc.controller;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.kyc.dto.RejectSignupRequest;
import com.erp.erp.kyc.dto.SignupDecisionResponse;
import com.erp.erp.kyc.dto.SignupReviewResponse;
import com.erp.erp.kyc.service.SignupReviewService;
import com.erp.erp.tenant.model.KycStatus;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Super-admin endpoints: list pending signups, view documents, approve or reject. */
@RestController
@RequestMapping("/api/v1/admin/signups")
public class KycAdminController {

    private final SignupReviewService reviewService;

    public KycAdminController(SignupReviewService reviewService) {
        this.reviewService = reviewService;
    }

    @GetMapping
    public List<SignupReviewResponse> list(@RequestParam(defaultValue = "PENDING") String status) {
        return reviewService.list(parseStatus(status));
    }

    @GetMapping("/{tenantId}/documents/{documentId}")
    public ResponseEntity<Resource> download(
            @PathVariable UUID tenantId, @PathVariable UUID documentId) {
        SignupReviewService.DownloadFile file = reviewService.download(tenantId, documentId);
        String disposition = ContentDisposition.inline()
                .filename(file.fileName(), StandardCharsets.UTF_8)
                .build()
                .toString();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(file.resource());
    }

    @PostMapping("/{tenantId}/approve")
    public SignupDecisionResponse approve(@PathVariable UUID tenantId) {
        return reviewService.approve(tenantId);
    }

    @PostMapping("/{tenantId}/reject")
    public SignupDecisionResponse reject(
            @PathVariable UUID tenantId, @Valid @RequestBody RejectSignupRequest request) {
        return reviewService.reject(tenantId, request.note());
    }

    private KycStatus parseStatus(String status) {
        try {
            return KycStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid status");
        }
    }
}

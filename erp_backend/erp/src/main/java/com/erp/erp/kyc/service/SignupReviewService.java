package com.erp.erp.kyc.service;

import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.kyc.dto.SignupDecisionResponse;
import com.erp.erp.kyc.dto.SignupDocumentResponse;
import com.erp.erp.kyc.dto.SignupReviewResponse;
import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import com.erp.erp.kyc.repository.SignupDocumentRepository;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Super-admin review of the signup KYC files. */
@Service
public class SignupReviewService {

    private final TenantRepository tenantRepository;
    private final SignupDocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final KycStorageService storageService;

    public SignupReviewService(
            TenantRepository tenantRepository,
            SignupDocumentRepository documentRepository,
            UserRepository userRepository,
            KycStorageService storageService) {
        this.tenantRepository = tenantRepository;
        this.documentRepository = documentRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
    }

    @Transactional(readOnly = true)
    public List<SignupReviewResponse> list(KycStatus status) {
        return tenantRepository.findByKycStatusOrderByCreatedAtDesc(status).stream()
                .map(this::toReviewResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public DownloadFile download(UUID tenantId, UUID documentId) {
        SignupDocument document = documentRepository
                .findByIdAndTenant_Id(documentId, tenantId)
                .orElseThrow(() -> new AuthException(404, "document not found"));
        return new DownloadFile(
                storageService.load(document.getStoragePath()),
                document.getOriginalFileName(),
                document.getContentType());
    }

    @Transactional
    public SignupDecisionResponse approve(UUID tenantId) {
        Tenant tenant = requirePending(tenantId);
        if (tenant.getBillingStatus() == null || !tenant.getBillingStatus().allowsKycApproval()) {
            throw new AuthException(400, "payment required before approval");
        }
        tenant.setKycStatus(KycStatus.APPROVED);
        tenant.setDecisionNote(null);
        tenant.setDecidedAt(Instant.now());
        return decision(tenant, "signup approved");
    }

    @Transactional
    public SignupDecisionResponse reject(UUID tenantId, String note) {
        Tenant tenant = requirePending(tenantId);
        tenant.setKycStatus(KycStatus.REJECTED);
        tenant.setDecisionNote(note.trim());
        tenant.setDecidedAt(Instant.now());
        return decision(tenant, "signup rejected");
    }

    private Tenant requirePending(UUID tenantId) {
        Tenant tenant = tenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new AuthException(404, "signup not found"));
        if (tenant.getKycStatus() != KycStatus.PENDING) {
            throw new AuthException(400, "signup already decided");
        }
        return tenant;
    }

    private SignupReviewResponse toReviewResponse(Tenant tenant) {
        String applicantName = userRepository
                .findFirstByTenantId(tenant.getId())
                .map(User::getFullName)
                .orElse(null);

        List<SignupDocumentResponse> documents = sortBySlot(
                        documentRepository.findByTenantId(tenant.getId()))
                .stream()
                .map(this::toDocumentResponse)
                .toList();

        return new SignupReviewResponse(TenantResponse.from(tenant), applicantName, documents);
    }

    /** The database sorts the enum as text, so keep the wizard order explicitly. */
    static List<SignupDocument> sortBySlot(List<SignupDocument> documents) {
        return documents.stream()
                .sorted(Comparator.comparingInt(document -> document.getSlot().ordinal()))
                .toList();
    }

    private SignupDocumentResponse toDocumentResponse(SignupDocument document) {
        long sizeKb = Math.max(1, Math.round(document.getSizeBytes() / 1024.0));
        return new SignupDocumentResponse(
                document.getId(),
                document.getSlot().getKey(),
                document.getOriginalFileName(),
                document.getContentType(),
                sizeKb,
                document.getUploadedAt() == null ? null : document.getUploadedAt().toString(),
                "/api/v1/admin/signups/" + document.getTenant().getId()
                        + "/documents/" + document.getId());
    }

    private SignupDecisionResponse decision(Tenant tenant, String message) {
        return new SignupDecisionResponse(
                tenant.getId(),
                tenant.getKycStatus().name(),
                tenant.getDecidedAt() == null ? null : tenant.getDecidedAt().toString(),
                tenant.getDecisionNote(),
                message);
    }

    /** File streamed back to the admin console. */
    public record DownloadFile(Resource resource, String fileName, String contentType) {}
}

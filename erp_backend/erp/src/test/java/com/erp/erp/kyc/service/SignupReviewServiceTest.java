package com.erp.erp.kyc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import com.erp.erp.kyc.repository.SignupDocumentRepository;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SignupReviewServiceTest {

    @Test
    void sortsDocumentsInSignupOrder() {
        List<SignupDocument> sorted = SignupReviewService.sortBySlot(List.of(
                document(DocumentSlot.TAX_REGISTRATION),
                document(DocumentSlot.ID_CARD_VERSO),
                document(DocumentSlot.TRADE_REGISTER),
                document(DocumentSlot.ID_CARD_RECTO)));

        assertEquals(
                List.of(
                        DocumentSlot.ID_CARD_RECTO,
                        DocumentSlot.ID_CARD_VERSO,
                        DocumentSlot.TRADE_REGISTER,
                        DocumentSlot.TAX_REGISTRATION),
                sorted.stream().map(SignupDocument::getSlot).toList());
    }

    @Test
    void approvalIsBlockedUntilBillingIsActiveOrExempt() {
        Tenant tenant = pendingTenant(BillingStatus.NONE);
        SignupReviewService service = serviceFor(tenant);

        AuthException ex = assertThrows(AuthException.class, () -> service.approve(tenant.getId()));

        assertEquals(400, ex.getStatus());
        assertEquals("payment required before approval", ex.getMessage());
    }

    @Test
    void approvalSucceedsWhenBillingIsExempt() {
        Tenant tenant = pendingTenant(BillingStatus.EXEMPT);
        SignupReviewService service = serviceFor(tenant);

        var response = service.approve(tenant.getId());

        assertEquals("APPROVED", response.status());
        assertEquals(KycStatus.APPROVED, tenant.getKycStatus());
    }

    private Tenant pendingTenant(BillingStatus billingStatus) {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setKycStatus(KycStatus.PENDING);
        tenant.setBillingStatus(billingStatus);
        return tenant;
    }

    private SignupReviewService serviceFor(Tenant tenant) {
        TenantRepository tenantRepository = mock(TenantRepository.class);
        when(tenantRepository.findById(tenant.getId())).thenReturn(Optional.of(tenant));
        return new SignupReviewService(
                tenantRepository,
                mock(SignupDocumentRepository.class),
                mock(UserRepository.class),
                mock(KycStorageService.class));
    }

    private SignupDocument document(DocumentSlot slot) {
        SignupDocument document = new SignupDocument();
        document.setSlot(slot);
        return document;
    }
}

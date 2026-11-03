package com.erp.erp.kyc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.model.SignupDocument;
import java.util.List;
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

    private SignupDocument document(DocumentSlot slot) {
        SignupDocument document = new SignupDocument();
        document.setSlot(slot);
        return document;
    }
}

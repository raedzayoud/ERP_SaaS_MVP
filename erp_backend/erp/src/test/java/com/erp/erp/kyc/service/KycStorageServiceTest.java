package com.erp.erp.kyc.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.kyc.model.DocumentSlot;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockMultipartFile;

class KycStorageServiceTest {

    private static final UUID TENANT_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID DOCUMENT_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");

    @TempDir
    Path tempDir;

    @Test
    void storesPngAndReturnsMetadata() {
        KycStorageService service = new KycStorageService(tempDir.toString(), 2048);
        MockMultipartFile file =
                new MockMultipartFile("file", "cin.png", "image/png", new byte[] {1, 2, 3});

        KycStorageService.StoredFile stored =
                service.store(file, TENANT_ID, USER_ID, DOCUMENT_ID, DocumentSlot.ID_CARD_RECTO);

        assertEquals("cin.png", stored.originalFileName());
        assertEquals("image/png", stored.contentType());
        assertEquals(TENANT_ID + "/" + USER_ID + "/" + DOCUMENT_ID + ".png", stored.storagePath());
        assertTrue(Files.isRegularFile(
                tempDir.resolve(TENANT_ID.toString()).resolve(USER_ID.toString()).resolve(DOCUMENT_ID + ".png")));
        assertNotNull(service.load(stored.storagePath()));
    }

    @Test
    void givesEachDocumentItsOwnFile() {
        KycStorageService service = new KycStorageService(tempDir.toString(), 2048);
        UUID otherDocumentId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        MockMultipartFile file =
                new MockMultipartFile("file", "cin.png", "image/png", new byte[] {1});

        service.store(file, TENANT_ID, USER_ID, DOCUMENT_ID, DocumentSlot.ID_CARD_RECTO);
        KycStorageService.StoredFile other =
                service.store(file, TENANT_ID, USER_ID, otherDocumentId, DocumentSlot.ID_CARD_VERSO);

        assertTrue(Files.isRegularFile(
                tempDir.resolve(TENANT_ID.toString()).resolve(USER_ID.toString()).resolve(otherDocumentId + ".png")));
        assertNotNull(other.storagePath());
    }

    @Test
    void rejectsUnsupportedType() {
        KycStorageService service = new KycStorageService(tempDir.toString(), 2048);
        MockMultipartFile file =
                new MockMultipartFile("file", "notes.txt", "text/plain", new byte[] {1});

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.store(file, TENANT_ID, USER_ID, DOCUMENT_ID, DocumentSlot.TRADE_REGISTER));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void rejectsOversizedFile() {
        KycStorageService service = new KycStorageService(tempDir.toString(), 1);
        MockMultipartFile file =
                new MockMultipartFile("file", "big.pdf", "application/pdf", new byte[2048]);

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.store(file, TENANT_ID, USER_ID, DOCUMENT_ID, DocumentSlot.TAX_REGISTRATION));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void resolvesSlotFromKeyOrEnumName() {
        assertTrue(DocumentSlot.fromKey("idCardRecto").isPresent());
        assertTrue(DocumentSlot.fromKey("ID_CARD_VERSO").isPresent());
        assertTrue(DocumentSlot.fromKey("unknown").isEmpty());
    }
}

package com.erp.erp.kyc.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.kyc.model.DocumentSlot;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Stores KYC files on the local filesystem:
 * {app.kyc.storage-dir}/{tenantId}/{userId}/{documentId}.{ext}
 * Only PNG, JPEG and PDF are accepted, and the size is limited.
 */
@Service
public class KycStorageService {

    private static final Set<String> ALLOWED_TYPES =
            Set.of("image/png", "image/jpeg", "application/pdf");

    private static final Map<String, String> EXTENSIONS = Map.of(
            "image/png", "png",
            "image/jpeg", "jpg",
            "application/pdf", "pdf");

    /** First bytes of each accepted format (file signature / magic bytes). */
    private static final Map<String, byte[]> SIGNATURES = Map.of(
            "image/png", new byte[] {(byte) 0x89, 0x50, 0x4E, 0x47},
            "image/jpeg", new byte[] {(byte) 0xFF, (byte) 0xD8},
            "application/pdf", new byte[] {0x25, 0x50, 0x44, 0x46});

    private final Path root;
    private final long maxBytes;

    public KycStorageService(
            @Value("${app.kyc.storage-dir:./uploads/images}") String storageDir,
            @Value("${app.kyc.max-file-size-kb:2048}") long maxFileSizeKb) {
        this.root = Path.of(storageDir).toAbsolutePath().normalize();
        this.maxBytes = maxFileSizeKb * 1024;
    }

    /** Checks the file without writing anything (used before saving DB rows). */
    public void validate(MultipartFile file, DocumentSlot slot) {
        checkedExtension(file, slot);
    }

    public StoredFile store(
            MultipartFile file, UUID tenantId, UUID userId, UUID documentId, DocumentSlot slot) {
        String extension = checkedExtension(file, slot);
        String contentType = contentType(file);

        Path directory = root.resolve(tenantId.toString()).resolve(userId.toString()).normalize();
        Path target = directory.resolve(documentId + "." + extension).normalize();
        if (!target.startsWith(root) || !target.startsWith(directory)) {
            throw new AuthException(400, slot.getKey() + ": invalid file path");
        }

        try {
            Files.createDirectories(directory);
            file.transferTo(target);
        } catch (IOException ex) {
            throw new AuthException(500, "could not store document");
        }

        String relativePath = root.relativize(target).toString().replace('\\', '/');
        return new StoredFile(file.getOriginalFilename(), contentType, file.getSize(), relativePath);
    }

    public Resource load(String storagePath) {
        Path target = resolveStoredPath(storagePath);
        if (!Files.isRegularFile(target)) {
            throw new AuthException(404, "document not found");
        }
        return new FileSystemResource(target);
    }

    /** Best effort: a leftover file must not break the API response. */
    public void deleteQuietly(String storagePath) {
        try {
            Files.deleteIfExists(resolveStoredPath(storagePath));
        } catch (IOException | AuthException ignored) {
            // Nothing else to do.
        }
    }

    private String checkedExtension(MultipartFile file, DocumentSlot slot) {
        if (file == null || file.isEmpty()) {
            throw new AuthException(400, slot.getKey() + ": file is empty");
        }

        String contentType = contentType(file);
        String extension = EXTENSIONS.get(contentType);
        if (extension == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new AuthException(400, slot.getKey() + ": accepted formats are PNG, JPG and PDF");
        }
        if (file.getSize() > maxBytes) {
            throw new AuthException(400, slot.getKey() + ": file is larger than " + (maxBytes / 1024) + " KB");
        }
        checkSignature(file, contentType, slot);
        return extension;
    }

    /** Rejects a file whose bytes are not the format declared in Content-Type. */
    private void checkSignature(MultipartFile file, String contentType, DocumentSlot slot) {
        byte[] expected = SIGNATURES.get(contentType);
        if (expected == null) {
            return;
        }

        byte[] actual = new byte[expected.length];
        try (InputStream in = file.getInputStream()) {
            if (in.readNBytes(actual, 0, actual.length) < actual.length
                    || !Arrays.equals(expected, actual)) {
                throw new AuthException(400, slot.getKey() + ": file content does not match its type");
            }
        } catch (IOException ex) {
            throw new AuthException(400, slot.getKey() + ": file could not be read");
        }
    }

    private String contentType(MultipartFile file) {
        return file.getContentType() == null ? "" : file.getContentType().toLowerCase();
    }

    private Path resolveStoredPath(String storagePath) {
        Path target = root.resolve(storagePath).normalize();
        if (!target.startsWith(root)) {
            throw new AuthException(400, "invalid storage path");
        }
        return target;
    }

    /** Metadata returned after a successful write. */
    public record StoredFile(String originalFileName, String contentType, long sizeBytes, String storagePath) {}
}

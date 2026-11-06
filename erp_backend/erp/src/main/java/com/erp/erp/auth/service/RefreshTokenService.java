package com.erp.erp.auth.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.RefreshToken;
import com.erp.erp.auth.repository.RefreshTokenRepository;
import com.erp.erp.user.model.User;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates, rotates and revokes the DB-backed opaque refresh tokens. */
@Service
public class RefreshTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final RefreshTokenRepository repository;
    private final long expirationMs;

    public RefreshTokenService(
            RefreshTokenRepository repository,
            @Value("${app.jwt.refresh-expiration-ms}") long expirationMs) {
        this.repository = repository;
        this.expirationMs = expirationMs;
    }

    /** Stores the hash and returns the raw token to send to the client. */
    @Transactional
    public String create(User user) {
        String rawToken = randomToken();
        Instant now = Instant.now();

        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash(hash(rawToken));
        token.setCreatedAt(now);
        token.setExpiresAt(now.plusMillis(expirationMs));
        repository.save(token);

        return rawToken;
    }

    /** Revokes the old token and creates a new one for the same user. */
    @Transactional
    public Rotation rotate(String rawToken) {
        RefreshToken stored = findValid(rawToken);
        User user = stored.getUser();
        if (!user.isActive()) {
            throw new AuthException(403, "account disabled");
        }

        stored.setRevokedAt(Instant.now());
        repository.save(stored);

        return new Rotation(user, create(user));
    }

    /** Idempotent: an unknown or already revoked token is ignored. */
    @Transactional
    public void revoke(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        repository.findByTokenHash(hash(rawToken)).ifPresent(token -> {
            if (token.getRevokedAt() == null) {
                token.setRevokedAt(Instant.now());
                repository.save(token);
            }
        });
    }

    private RefreshToken findValid(String rawToken) {
        RefreshToken stored = repository
                .findByTokenHash(hash(rawToken))
                .orElseThrow(() -> new AuthException(401, "invalid refresh token"));

        if (stored.getRevokedAt() != null || !stored.getExpiresAt().isAfter(Instant.now())) {
            throw new AuthException(401, "invalid refresh token");
        }
        return stored;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    public record Rotation(User user, String refreshToken) {}
}

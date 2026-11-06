package com.erp.erp.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.RefreshToken;
import com.erp.erp.auth.repository.RefreshTokenRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class RefreshTokenServiceTest {

    private final RefreshTokenRepository repository = mock(RefreshTokenRepository.class);
    private final RefreshTokenService service =
            new RefreshTokenService(repository, 2_592_000_000L);

    @Test
    void createStoresOnlyTheHashAndReturnsTheRawToken() {
        String rawToken = service.create(activeUser());

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(repository).save(captor.capture());

        assertNotNull(rawToken);
        assertEquals(64, captor.getValue().getTokenHash().length());
        assertNotEquals(rawToken, captor.getValue().getTokenHash());
        assertTrue(captor.getValue().getExpiresAt().isAfter(Instant.now()));
    }

    @Test
    void rotateRevokesTheOldTokenAndCreatesANewOne() {
        User user = activeUser();
        RefreshToken stored = token(user, Instant.now().plusSeconds(3600));
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        RefreshTokenService.Rotation rotation = service.rotate("old-token");

        assertNotNull(stored.getRevokedAt());
        assertNotNull(rotation.refreshToken());
        assertEquals(user, rotation.user());
        verify(repository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    void rotateRejectsExpiredAndRevokedTokens() {
        User user = activeUser();

        RefreshToken expired = token(user, Instant.now().minusSeconds(1));
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(expired));
        AuthException expiredError =
                assertThrows(AuthException.class, () -> service.rotate("expired"));
        assertEquals(401, expiredError.getStatus());

        RefreshToken revoked = token(user, Instant.now().plusSeconds(3600));
        revoked.setRevokedAt(Instant.now());
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(revoked));
        AuthException revokedError =
                assertThrows(AuthException.class, () -> service.rotate("revoked"));
        assertEquals(401, revokedError.getStatus());
    }

    @Test
    void revokeMarksTheTokenWithoutFailingForUnknownTokens() {
        RefreshToken stored = token(activeUser(), Instant.now().plusSeconds(3600));
        when(repository.findByTokenHash(anyString())).thenReturn(Optional.of(stored));

        service.revoke("token");

        assertNotNull(stored.getRevokedAt());
        verify(repository).save(stored);

        when(repository.findByTokenHash(anyString())).thenReturn(Optional.empty());
        service.revoke("unknown");
    }

    private User activeUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("owner@acme.com");
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setActive(true);
        return user;
    }

    private RefreshToken token(User user, Instant expiresAt) {
        RefreshToken token = new RefreshToken();
        token.setUser(user);
        token.setTokenHash("stored-hash");
        token.setCreatedAt(Instant.now());
        token.setExpiresAt(expiresAt);
        return token;
    }
}

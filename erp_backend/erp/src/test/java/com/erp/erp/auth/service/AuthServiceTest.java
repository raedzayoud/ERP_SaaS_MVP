package com.erp.erp.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.RefreshTokenRequest;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.SignupResponse;
import com.erp.erp.auth.dto.TokenPairResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.billing.service.BillingService;
import com.erp.erp.config.JwtService;
import com.erp.erp.kyc.model.DocumentSlot;
import com.erp.erp.kyc.repository.SignupDocumentRepository;
import com.erp.erp.kyc.service.KycStorageService;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.multipart.MultipartFile;

class AuthServiceTest {

    private final UserRepository users = mock(UserRepository.class);
    private final TenantRepository tenants = mock(TenantRepository.class);
    private final SignupDocumentRepository documents = mock(SignupDocumentRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final JwtService jwtService = mock(JwtService.class);
    private final RefreshTokenService refreshTokens = mock(RefreshTokenService.class);
    private final KycStorageService storage = mock(KycStorageService.class);
    private final BillingService billing = mock(BillingService.class);

    private final AuthService service = new AuthService(
            users, tenants, documents, passwordEncoder, jwtService, refreshTokens, storage, billing);

    @Test
    void loginReturnsAccessAndRefreshTokens() {
        User user = activeUser();

        when(users.findByEmail("owner@acme.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "hash")).thenReturn(true);
        when(jwtService.generateToken(user)).thenReturn("jwt-token");
        when(jwtService.getExpirationSeconds()).thenReturn(900L);
        when(refreshTokens.create(user)).thenReturn("refresh-token");

        TokenPairResponse response = service.login(new LoginRequest("owner@acme.com", "secret123"));

        assertEquals("jwt-token", response.accessToken());
        assertEquals("refresh-token", response.refreshToken());
        assertEquals("Bearer", response.tokenType());
        assertEquals(900, response.expiresIn());
    }

    @Test
    void refreshRotatesTheTokenAndReturnsANewPair() {
        User user = activeUser();
        when(refreshTokens.rotate("old-refresh"))
                .thenReturn(new RefreshTokenService.Rotation(user, "new-refresh"));
        when(jwtService.generateToken(user)).thenReturn("new-access");
        when(jwtService.getExpirationSeconds()).thenReturn(900L);

        TokenPairResponse response = service.refresh(new RefreshTokenRequest("old-refresh"));

        assertEquals("new-access", response.accessToken());
        assertEquals("new-refresh", response.refreshToken());
    }

    @Test
    void logoutRevokesTheRefreshToken() {
        service.logout(new RefreshTokenRequest("refresh-token"));

        verify(refreshTokens).revoke("refresh-token");
    }

    @Test
    void signupReturnsTheStripeCheckoutUrlAndKeepsTheSelectedPlan() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        stubSignupPersistence(tenantId, userId);
        when(billing.checkout(tenantId, "MONTHLY"))
                .thenReturn(new BillingUrlResponse("https://checkout.stripe.com/test"));

        SignupResponse response = service.signup(starterRequest(), documents());

        assertEquals(
                "Account created. Complete the Stripe payment, then wait for administrator approval.",
                response.message());
        assertEquals("https://checkout.stripe.com/test", response.checkoutUrl());
        verify(billing).checkout(tenantId, "MONTHLY");

        ArgumentCaptor<Tenant> tenantCaptor = ArgumentCaptor.forClass(Tenant.class);
        verify(tenants).save(tenantCaptor.capture());
        assertEquals("starter", tenantCaptor.getValue().getPlanId());
    }

    @Test
    void signupDeletesStoredFilesWhenStripeFails() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        stubSignupPersistence(tenantId, userId);
        when(billing.checkout(tenantId, "MONTHLY"))
                .thenThrow(new AuthException(502, "payment provider error"));

        AuthException ex = assertThrows(
                AuthException.class, () -> service.signup(starterRequest(), documents()));

        assertEquals(502, ex.getStatus());
        verify(storage, times(4)).deleteQuietly(anyString());
        verify(billing).deleteCustomerQuietly(null);
    }

    @Test
    void signupDeletesStoredFilesWhenDocumentInsertFails() {
        UUID tenantId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        stubSignupPersistence(tenantId, userId);
        when(documents.saveAllAndFlush(anyList()))
                .thenThrow(new RuntimeException("database unavailable"));

        assertThrows(RuntimeException.class, () -> service.signup(starterRequest(), documents()));

        verify(storage, times(4)).deleteQuietly(anyString());
    }

    private User activeUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("owner@acme.com");
        user.setPasswordHash("hash");
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setActive(true);
        return user;
    }

    private void stubSignupPersistence(UUID tenantId, UUID userId) {
        when(users.existsByEmail("owner@acme.com")).thenReturn(false);
        when(tenants.existsBySubdomain("acme")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("hash");
        when(tenants.save(any(Tenant.class))).thenAnswer(invocation -> {
            Tenant tenant = invocation.getArgument(0);
            tenant.setId(tenantId);
            return tenant;
        });
        when(users.save(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId(userId);
            return user;
        });
        when(storage.store(any(), eq(tenantId), eq(userId), any(UUID.class), any(DocumentSlot.class)))
                .thenReturn(new KycStorageService.StoredFile(
                        "document.png", "image/png", 3L, "tenant/user/document.png"));
    }

    private SignupRequest starterRequest() {
        return new SignupRequest(
                "Acme Owner",
                "Acme",
                "acme",
                "owner@acme.com",
                "secret123",
                "France",
                "fr",
                "1-10",
                "FR12345",
                List.of("dashboard", "contacts", "products", "sales", "invoices", "payments"),
                "starter",
                "MONTHLY");
    }

    private Map<DocumentSlot, MultipartFile> documents() {
        Map<DocumentSlot, MultipartFile> files = new EnumMap<>(DocumentSlot.class);
        for (DocumentSlot slot : DocumentSlot.values()) {
            files.put(slot, new MockMultipartFile(
                    slot.getKey(), "document.png", "image/png", new byte[] {1, 2, 3}));
        }
        return files;
    }
}

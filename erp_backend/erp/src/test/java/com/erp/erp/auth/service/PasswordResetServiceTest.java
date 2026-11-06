package com.erp.erp.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.dto.AuthMessageResponse;
import com.erp.erp.auth.dto.ForgotPasswordRequest;
import com.erp.erp.auth.dto.ForgotPasswordResponse;
import com.erp.erp.auth.dto.ResetPasswordRequest;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.PasswordResetCode;
import com.erp.erp.auth.repository.PasswordResetCodeRepository;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.MailSendException;
import org.springframework.security.crypto.password.PasswordEncoder;

class PasswordResetServiceTest {

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordResetCodeRepository codes = mock(PasswordResetCodeRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final PasswordResetMailService mailService = mock(PasswordResetMailService.class);

    private final PasswordResetService service = new PasswordResetService(
            users, codes, passwordEncoder, mailService, 15, 5, 60);

    @Test
    void forgotPasswordRejectsUnknownEmail() {
        when(users.findByEmail("missing@acme.com")).thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.forgotPassword(new ForgotPasswordRequest("missing@acme.com")));

        assertEquals(404, ex.getStatus());
        assertEquals("no account found for this email", ex.getMessage());
        verify(mailService, never()).sendCode(anyString(), anyString());
    }

    @Test
    void forgotPasswordSendsAndStoresAHashedCode() {
        User user = activeUser();
        when(users.findByEmail("owner@acme.com")).thenReturn(Optional.of(user));
        when(codes.findByUserId(user.getId())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString()))
                .thenAnswer(invocation -> "hash:" + invocation.getArgument(0));

        ForgotPasswordResponse response =
                service.forgotPassword(new ForgotPasswordRequest("OWNER@ACME.COM"));

        assertEquals("reset code sent; it expires in 15 minutes", response.message());
        assertEquals(15, response.expiresInMinutes());

        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendCode(eq("owner@acme.com"), codeCaptor.capture());
        String code = codeCaptor.getValue();
        assertTrue(code.matches("\\d{6}"));

        ArgumentCaptor<PasswordResetCode> resetCaptor =
                ArgumentCaptor.forClass(PasswordResetCode.class);
        verify(codes).saveAndFlush(resetCaptor.capture());
        PasswordResetCode saved = resetCaptor.getValue();
        assertEquals("hash:" + code, saved.getCodeHash());
        assertEquals(0, saved.getAttempts());
        assertTrue(saved.getExpiresAt().isAfter(Instant.now()));
        assertEquals(user, saved.getUser());
    }

    @Test
    void forgotPasswordEnforcesTheResendCooldown() {
        User user = activeUser();
        PasswordResetCode resetCode = resetCode(user, Instant.now().plusSeconds(600));
        resetCode.setLastSentAt(Instant.now());
        when(users.findByEmail("owner@acme.com")).thenReturn(Optional.of(user));
        when(codes.findByUserId(user.getId())).thenReturn(Optional.of(resetCode));

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.forgotPassword(new ForgotPasswordRequest("owner@acme.com")));

        assertEquals(429, ex.getStatus());
        verify(mailService, never()).sendCode(anyString(), anyString());
        verify(codes, never()).saveAndFlush(any(PasswordResetCode.class));
    }

    @Test
    void forgotPasswordReturnsBadGatewayWhenMailFails() {
        User user = activeUser();
        when(users.findByEmail("owner@acme.com")).thenReturn(Optional.of(user));
        when(codes.findByUserId(user.getId())).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("hash");
        doThrow(new MailSendException("smtp down"))
                .when(mailService)
                .sendCode(anyString(), anyString());

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.forgotPassword(new ForgotPasswordRequest("owner@acme.com")));

        assertEquals(502, ex.getStatus());
    }

    @Test
    void resetPasswordRejectsAnExpiredCodeAndDeletesIt() {
        User user = activeUser();
        PasswordResetCode resetCode = resetCode(user, Instant.now().minusSeconds(60));
        stubReset(user, resetCode);

        AuthException ex = assertThrows(AuthException.class, () -> service.resetPassword(
                new ResetPasswordRequest("owner@acme.com", "123456", "newsecret")));

        assertEquals(400, ex.getStatus());
        assertEquals("reset code expired", ex.getMessage());
        verify(codes).delete(resetCode);
        verify(users, never()).save(any(User.class));
    }

    @Test
    void resetPasswordCountsAWrongCodeAttempt() {
        User user = activeUser();
        PasswordResetCode resetCode = resetCode(user, Instant.now().plusSeconds(600));
        resetCode.setAttempts(1);
        stubReset(user, resetCode);
        when(passwordEncoder.matches("000000", resetCode.getCodeHash())).thenReturn(false);

        AuthException ex = assertThrows(AuthException.class, () -> service.resetPassword(
                new ResetPasswordRequest("owner@acme.com", "000000", "newsecret")));

        assertEquals(400, ex.getStatus());
        assertEquals("incorrect reset code", ex.getMessage());
        assertEquals(2, resetCode.getAttempts());
        verify(codes).save(resetCode);
        verify(codes, never()).delete(resetCode);
    }

    @Test
    void resetPasswordDeletesTheCodeAfterTooManyAttempts() {
        User user = activeUser();
        PasswordResetCode resetCode = resetCode(user, Instant.now().plusSeconds(600));
        resetCode.setAttempts(5);
        stubReset(user, resetCode);

        AuthException ex = assertThrows(AuthException.class, () -> service.resetPassword(
                new ResetPasswordRequest("owner@acme.com", "123456", "newsecret")));

        assertEquals(400, ex.getStatus());
        assertEquals("too many attempts; request a new reset code", ex.getMessage());
        verify(codes).delete(resetCode);
        verify(mailService, never()).sendCode(anyString(), anyString());
    }

    @Test
    void resetPasswordUpdatesThePasswordAndDeletesTheCode() {
        User user = activeUser();
        PasswordResetCode resetCode = resetCode(user, Instant.now().plusSeconds(600));
        stubReset(user, resetCode);
        when(passwordEncoder.matches("123456", resetCode.getCodeHash())).thenReturn(true);
        when(passwordEncoder.encode("newsecret")).thenReturn("new-hash");

        AuthMessageResponse response = service.resetPassword(
                new ResetPasswordRequest("owner@acme.com", "123456", "newsecret"));

        assertEquals("password updated", response.message());
        assertEquals("new-hash", user.getPasswordHash());
        assertFalse(user.isMustRenewPassword());
        verify(users).save(user);
        verify(codes).delete(resetCode);
    }

    private void stubReset(User user, PasswordResetCode resetCode) {
        when(users.findByEmail("owner@acme.com")).thenReturn(Optional.of(user));
        when(codes.findByUserId(user.getId())).thenReturn(Optional.of(resetCode));
    }

    private User activeUser() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setFullName("Acme Owner");
        user.setEmail("owner@acme.com");
        user.setPasswordHash("old-hash");
        user.setRole(Role.ADMIN_ENTREPRISE);
        user.setActive(true);
        return user;
    }

    private PasswordResetCode resetCode(User user, Instant expiresAt) {
        PasswordResetCode resetCode = new PasswordResetCode();
        resetCode.setUser(user);
        resetCode.setCodeHash("hash:123456");
        resetCode.setExpiresAt(expiresAt);
        resetCode.setAttempts(0);
        resetCode.setLastSentAt(Instant.now().minusSeconds(120));
        return resetCode;
    }
}

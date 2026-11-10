package com.erp.erp.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.dto.SignupOtpSendRequest;
import com.erp.erp.auth.dto.SignupOtpSendResponse;
import com.erp.erp.auth.dto.SignupOtpVerifyRequest;
import com.erp.erp.auth.dto.SignupOtpVerifyResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.SignupOtpCode;
import com.erp.erp.auth.repository.SignupOtpCodeRepository;
import com.erp.erp.user.repository.UserRepository;
import java.time.Instant;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.password.PasswordEncoder;

class SignupOtpServiceTest {

    private final SignupOtpCodeRepository codes = mock(SignupOtpCodeRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final SignupOtpMailService mail = mock(SignupOtpMailService.class);

    private final SignupOtpService service = new SignupOtpService(
            codes, users, passwordEncoder, mail, 15, 5, 60, 15);

    @Test
    void sendRejectsAnEmailThatAlreadyHasAnAccount() {
        when(users.existsByEmail("owner@acme.com")).thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.send(new SignupOtpSendRequest("Owner@Acme.com")));

        assertEquals(400, ex.getStatus());
        assertEquals("email already in use", ex.getMessage());
        verify(mail, never()).sendCode(anyString(), anyString());
    }

    @Test
    void sendStoresAHashedCodeAndSendsThePlainCode() {
        when(users.existsByEmail("owner@acme.com")).thenReturn(false);
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("code-hash");

        SignupOtpSendResponse response =
                service.send(new SignupOtpSendRequest("Owner@Acme.com"));

        assertEquals(15, response.expiresInMinutes());
        assertEquals(60, response.resendAfterSeconds());

        ArgumentCaptor<SignupOtpCode> codeCaptor = ArgumentCaptor.forClass(SignupOtpCode.class);
        verify(codes).saveAndFlush(codeCaptor.capture());
        assertEquals("owner@acme.com", codeCaptor.getValue().getEmail());
        assertEquals("code-hash", codeCaptor.getValue().getCodeHash());
        assertEquals(0, codeCaptor.getValue().getAttempts());
        assertTrue(codeCaptor.getValue().getExpiresAt().isAfter(Instant.now()));

        ArgumentCaptor<String> plainCode = ArgumentCaptor.forClass(String.class);
        verify(mail).sendCode(eq("owner@acme.com"), plainCode.capture());
        assertTrue(plainCode.getValue().matches("\\d{6}"));
    }

    @Test
    void sendRejectsARequestDuringTheResendCooldown() {
        SignupOtpCode existing = code(Instant.now().plusSeconds(60 * 15), 0);
        existing.setLastSentAt(Instant.now());
        when(users.existsByEmail("owner@acme.com")).thenReturn(false);
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.of(existing));

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.send(new SignupOtpSendRequest("owner@acme.com")));

        assertEquals(429, ex.getStatus());
        assertEquals("please wait before requesting another code", ex.getMessage());
    }

    @Test
    void verifyReturnsAVerificationTokenForTheCorrectCode() {
        SignupOtpCode otp = code(Instant.now().plusSeconds(60 * 15), 0);
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.of(otp));
        when(passwordEncoder.matches("123456", "code-hash")).thenReturn(true);
        when(passwordEncoder.encode(anyString())).thenReturn("token-hash");

        SignupOtpVerifyResponse response =
                service.verify(new SignupOtpVerifyRequest("owner@acme.com", "123456"));

        assertNotNull(response.verificationToken());
        assertEquals(15, response.expiresInMinutes());
        assertEquals("token-hash", otp.getVerificationTokenHash());
        assertNotNull(otp.getVerifiedUntil());
        verify(codes).save(otp);
    }

    @Test
    void verifyCountsAWrongCodeAndDeletesAfterTooManyAttempts() {
        SignupOtpCode otp = code(Instant.now().plusSeconds(60 * 15), 0);
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.of(otp));
        when(passwordEncoder.matches("000000", "code-hash")).thenReturn(false);

        AuthException first = assertThrows(
                AuthException.class,
                () -> service.verify(new SignupOtpVerifyRequest("owner@acme.com", "000000")));

        assertEquals("incorrect verification code", first.getMessage());
        assertEquals(1, otp.getAttempts());
        verify(codes).save(otp);

        otp.setAttempts(5);
        AuthException tooMany = assertThrows(
                AuthException.class,
                () -> service.verify(new SignupOtpVerifyRequest("owner@acme.com", "000000")));

        assertEquals("too many attempts; request a new verification code", tooMany.getMessage());
        verify(codes).delete(otp);
    }

    @Test
    void requireVerifiedAcceptsAValidTokenAndRejectsAMissingOne() {
        SignupOtpCode otp = code(Instant.now().plusSeconds(60 * 15), 0);
        otp.setVerificationTokenHash("token-hash");
        otp.setVerifiedUntil(Instant.now().plusSeconds(60 * 15));
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.of(otp));
        when(passwordEncoder.matches("verified-token", "token-hash")).thenReturn(true);

        service.requireVerified("Owner@Acme.com", "verified-token");

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.requireVerified("owner@acme.com", " "));

        assertEquals(400, ex.getStatus());
        assertEquals("email verification required or expired", ex.getMessage());
    }

    @Test
    void clearDeletesTheCodeForTheEmail() {
        SignupOtpCode otp = code(Instant.now().plusSeconds(60 * 15), 0);
        when(codes.findByEmail("owner@acme.com")).thenReturn(Optional.of(otp));

        service.clear("Owner@Acme.com");

        verify(codes).delete(otp);
    }

    private SignupOtpCode code(Instant expiresAt, int attempts) {
        SignupOtpCode otp = new SignupOtpCode();
        otp.setEmail("owner@acme.com");
        otp.setCodeHash("code-hash");
        otp.setExpiresAt(expiresAt);
        otp.setAttempts(attempts);
        otp.setLastSentAt(Instant.now());
        return otp;
    }
}

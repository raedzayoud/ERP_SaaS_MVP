package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.SignupOtpSendRequest;
import com.erp.erp.auth.dto.SignupOtpSendResponse;
import com.erp.erp.auth.dto.SignupOtpVerifyRequest;
import com.erp.erp.auth.dto.SignupOtpVerifyResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.SignupOtpCode;
import com.erp.erp.auth.repository.SignupOtpCodeRepository;
import com.erp.erp.user.repository.UserRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Sends and checks the email code required before creating a signup. */
@Service
public class SignupOtpService {

    private final SignupOtpCodeRepository codeRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SignupOtpMailService mailService;
    private final SecureRandom random = new SecureRandom();
    private final long ttlMinutes;
    private final int maxAttempts;
    private final long resendCooldownSeconds;
    private final long verificationTtlMinutes;

    public SignupOtpService(
            SignupOtpCodeRepository codeRepository,
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            SignupOtpMailService mailService,
            @Value("${app.signup-otp.code-ttl-minutes}") long ttlMinutes,
            @Value("${app.signup-otp.max-attempts}") int maxAttempts,
            @Value("${app.signup-otp.resend-cooldown-seconds}") long resendCooldownSeconds,
            @Value("${app.signup-otp.verification-ttl-minutes}") long verificationTtlMinutes) {
        this.codeRepository = codeRepository;
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.ttlMinutes = ttlMinutes;
        this.maxAttempts = maxAttempts;
        this.resendCooldownSeconds = resendCooldownSeconds;
        this.verificationTtlMinutes = verificationTtlMinutes;
    }

    @Transactional
    public SignupOtpSendResponse send(SignupOtpSendRequest request) {
        String email = normalize(request.email());
        if (userRepository.existsByEmail(email)) {
            throw new AuthException(400, "email already in use");
        }

        Instant now = Instant.now();
        SignupOtpCode otp = codeRepository.findByEmail(email).orElse(null);
        if (otp != null && otp.getLastSentAt().plusSeconds(resendCooldownSeconds).isAfter(now)) {
            throw new AuthException(429, "please wait before requesting another code");
        }
        if (otp == null) {
            otp = new SignupOtpCode();
            otp.setEmail(email);
        }

        String code = generateCode();
        otp.setCodeHash(passwordEncoder.encode(code));
        otp.setExpiresAt(now.plusSeconds(ttlMinutes * 60));
        otp.setAttempts(0);
        otp.setLastSentAt(now);
        otp.setVerificationTokenHash(null);
        otp.setVerifiedUntil(null);
        codeRepository.saveAndFlush(otp);

        try {
            mailService.sendCode(email, code);
        } catch (MailException ex) {
            throw new AuthException(502, "could not send verification email");
        }

        return new SignupOtpSendResponse(
                "verification code sent; it expires in " + ttlMinutes + " minutes",
                ttlMinutes,
                resendCooldownSeconds);
    }

    @Transactional(noRollbackFor = AuthException.class)
    public SignupOtpVerifyResponse verify(SignupOtpVerifyRequest request) {
        String email = normalize(request.email());
        SignupOtpCode otp = codeRepository
                .findByEmail(email)
                .orElseThrow(() -> new AuthException(400, "no verification code requested for this email"));

        Instant now = Instant.now();
        if (!otp.getExpiresAt().isAfter(now)) {
            codeRepository.delete(otp);
            throw new AuthException(400, "verification code expired");
        }
        if (otp.getAttempts() >= maxAttempts) {
            codeRepository.delete(otp);
            throw new AuthException(400, "too many attempts; request a new verification code");
        }
        if (!passwordEncoder.matches(request.code(), otp.getCodeHash())) {
            otp.setAttempts(otp.getAttempts() + 1);
            if (otp.getAttempts() >= maxAttempts) {
                codeRepository.delete(otp);
                throw new AuthException(400, "too many attempts; request a new verification code");
            }
            codeRepository.save(otp);
            throw new AuthException(400, "incorrect verification code");
        }

        String token = UUID.randomUUID().toString();
        otp.setVerificationTokenHash(passwordEncoder.encode(token));
        otp.setVerifiedUntil(now.plusSeconds(verificationTtlMinutes * 60));
        codeRepository.save(otp);

        return new SignupOtpVerifyResponse(token, verificationTtlMinutes);
    }

    /** Called by AuthService.signup before creating any tenant or user. */
    @Transactional(readOnly = true)
    public void requireVerified(String email, String token) {
        if (token == null || token.isBlank()) {
            throw new AuthException(400, "email verification required or expired");
        }

        SignupOtpCode otp = codeRepository
                .findByEmail(normalize(email))
                .orElseThrow(() -> new AuthException(400, "email verification required or expired"));

        Instant now = Instant.now();
        if (otp.getVerifiedUntil() == null
                || !otp.getVerifiedUntil().isAfter(now)
                || otp.getVerificationTokenHash() == null
                || !passwordEncoder.matches(token, otp.getVerificationTokenHash())) {
            throw new AuthException(400, "email verification required or expired");
        }
    }

    /** Removes the code once the signup has been created successfully. */
    @Transactional
    public void clear(String email) {
        codeRepository.findByEmail(normalize(email)).ifPresent(codeRepository::delete);
    }

    private String generateCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }

    private String normalize(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }
}

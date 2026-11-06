package com.erp.erp.auth.service;

import com.erp.erp.auth.dto.AuthMessageResponse;
import com.erp.erp.auth.dto.ForgotPasswordRequest;
import com.erp.erp.auth.dto.ForgotPasswordResponse;
import com.erp.erp.auth.dto.ResetPasswordRequest;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.auth.model.PasswordResetCode;
import com.erp.erp.auth.repository.PasswordResetCodeRepository;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.security.SecureRandom;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PasswordResetService {

    private final UserRepository userRepository;
    private final PasswordResetCodeRepository codeRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordResetMailService mailService;
    private final SecureRandom random = new SecureRandom();
    private final long ttlMinutes;
    private final int maxAttempts;
    private final long resendCooldownSeconds;

    public PasswordResetService(
            UserRepository userRepository,
            PasswordResetCodeRepository codeRepository,
            PasswordEncoder passwordEncoder,
            PasswordResetMailService mailService,
            @Value("${app.password-reset.code-ttl-minutes}") long ttlMinutes,
            @Value("${app.password-reset.max-attempts}") int maxAttempts,
            @Value("${app.password-reset.resend-cooldown-seconds}") long resendCooldownSeconds) {
        this.userRepository = userRepository;
        this.codeRepository = codeRepository;
        this.passwordEncoder = passwordEncoder;
        this.mailService = mailService;
        this.ttlMinutes = ttlMinutes;
        this.maxAttempts = maxAttempts;
        this.resendCooldownSeconds = resendCooldownSeconds;
    }

    @Transactional
    public ForgotPasswordResponse forgotPassword(ForgotPasswordRequest request) {
        User user = findActiveUser(request.email());
        Instant now = Instant.now();

        PasswordResetCode resetCode = codeRepository.findByUserId(user.getId()).orElse(null);
        if (resetCode != null
                && resetCode.getLastSentAt().plusSeconds(resendCooldownSeconds).isAfter(now)) {
            throw new AuthException(429, "please wait before requesting another code");
        }
        if (resetCode == null) {
            resetCode = new PasswordResetCode();
            resetCode.setUser(user);
        }

        String code = generateCode();
        resetCode.setCodeHash(passwordEncoder.encode(code));
        resetCode.setExpiresAt(now.plusSeconds(ttlMinutes * 60));
        resetCode.setAttempts(0);
        resetCode.setLastSentAt(now);
        codeRepository.saveAndFlush(resetCode);

        try {
            mailService.sendCode(user.getEmail(), code);
        } catch (MailException ex) {
            throw new AuthException(502, "could not send reset email");
        }

        return new ForgotPasswordResponse(
                "reset code sent; it expires in " + ttlMinutes + " minutes", ttlMinutes);
    }

    @Transactional(noRollbackFor = AuthException.class)
    public AuthMessageResponse resetPassword(ResetPasswordRequest request) {
        User user = findActiveUser(request.email());
        PasswordResetCode resetCode = codeRepository
                .findByUserId(user.getId())
                .orElseThrow(() -> new AuthException(400, "no reset code requested for this email"));

        Instant now = Instant.now();
        if (!resetCode.getExpiresAt().isAfter(now)) {
            codeRepository.delete(resetCode);
            throw new AuthException(400, "reset code expired");
        }
        if (resetCode.getAttempts() >= maxAttempts) {
            codeRepository.delete(resetCode);
            throw new AuthException(400, "too many attempts; request a new reset code");
        }
        if (!passwordEncoder.matches(request.code(), resetCode.getCodeHash())) {
            resetCode.setAttempts(resetCode.getAttempts() + 1);
            if (resetCode.getAttempts() >= maxAttempts) {
                codeRepository.delete(resetCode);
                throw new AuthException(400, "too many attempts; request a new reset code");
            }
            codeRepository.save(resetCode);
            throw new AuthException(400, "incorrect reset code");
        }

        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.setMustRenewPassword(false);
        userRepository.save(user);
        codeRepository.delete(resetCode);

        return new AuthMessageResponse("password updated");
    }

    private User findActiveUser(String email) {
        String normalized = email.trim().toLowerCase();
        return userRepository
                .findByEmail(normalized)
                .filter(User::isActive)
                .orElseThrow(() -> new AuthException(404, "no account found for this email"));
    }

    private String generateCode() {
        return String.format("%06d", random.nextInt(1_000_000));
    }
}

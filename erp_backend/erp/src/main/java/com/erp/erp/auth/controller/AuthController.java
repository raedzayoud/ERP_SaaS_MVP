package com.erp.erp.auth.controller;

import com.erp.erp.auth.dto.AuthMessageResponse;
import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.ForgotPasswordRequest;
import com.erp.erp.auth.dto.ForgotPasswordResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.RefreshTokenRequest;
import com.erp.erp.auth.dto.ResetPasswordRequest;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.dto.SignupResponse;
import com.erp.erp.auth.dto.TokenPairResponse;
import com.erp.erp.auth.service.AuthService;
import com.erp.erp.auth.service.PasswordResetService;
import com.erp.erp.kyc.model.DocumentSlot;
import jakarta.validation.Valid;
import java.util.EnumMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    public AuthController(AuthService authService, PasswordResetService passwordResetService) {
        this.authService = authService;
        this.passwordResetService = passwordResetService;
    }

    @PostMapping("/login")
    public ResponseEntity<TokenPairResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenPairResponse> refresh(
            @Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
        authService.logout(request);
        return ResponseEntity.noContent().build();
    }

    /**
     * multipart/form-data:
     * - part "data": the JSON SignupRequest
     * - parts "idCardRecto", "idCardVerso", "tradeRegister", "taxRegistration": the KYC files
     */
    @PostMapping(value = "/signup", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<SignupResponse> signup(
            @Valid @RequestPart("data") SignupRequest data,
            @RequestPart("idCardRecto") MultipartFile idCardRecto,
            @RequestPart("idCardVerso") MultipartFile idCardVerso,
            @RequestPart("tradeRegister") MultipartFile tradeRegister,
            @RequestPart("taxRegistration") MultipartFile taxRegistration) {

        Map<DocumentSlot, MultipartFile> documents = new EnumMap<>(DocumentSlot.class);
        documents.put(DocumentSlot.ID_CARD_RECTO, idCardRecto);
        documents.put(DocumentSlot.ID_CARD_VERSO, idCardVerso);
        documents.put(DocumentSlot.TRADE_REGISTER, tradeRegister);
        documents.put(DocumentSlot.TAX_REGISTRATION, taxRegistration);

        return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(data, documents));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ForgotPasswordResponse> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {
        return ResponseEntity.ok(passwordResetService.forgotPassword(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<AuthMessageResponse> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {
        return ResponseEntity.ok(passwordResetService.resetPassword(request));
    }

    /** Returns the current user + tenant from the JWT. Protected by the filter chain. */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(authService.me(jwt.getSubject()));
    }
}

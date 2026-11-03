package com.erp.erp.auth.controller;

import com.erp.erp.auth.dto.AuthResponse;
import com.erp.erp.auth.dto.LoginRequest;
import com.erp.erp.auth.dto.SignupRequest;
import com.erp.erp.auth.service.AuthService;
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

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /**
     * multipart/form-data:
     * - part "data": the JSON SignupRequest
     * - parts "idCardRecto", "idCardVerso", "tradeRegister", "taxRegistration": the KYC files
     */
    @PostMapping(value = "/signup", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<AuthResponse> signup(
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

    /** Returns the current user + tenant from the JWT. Protected by the filter chain. */
    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ResponseEntity.ok(authService.me(jwt.getSubject()));
    }
}

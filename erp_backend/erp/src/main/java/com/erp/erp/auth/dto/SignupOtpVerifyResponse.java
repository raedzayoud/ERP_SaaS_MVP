package com.erp.erp.auth.dto;

public record SignupOtpVerifyResponse(
        String verificationToken, long expiresInMinutes) {}

package com.erp.erp.auth.dto;

public record SignupOtpSendResponse(
        String message, long expiresInMinutes, long resendAfterSeconds) {}

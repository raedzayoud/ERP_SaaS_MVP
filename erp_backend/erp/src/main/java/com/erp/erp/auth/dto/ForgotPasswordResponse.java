package com.erp.erp.auth.dto;

public record ForgotPasswordResponse(String message, long expiresInMinutes) {}

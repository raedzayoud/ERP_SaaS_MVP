package com.erp.erp.auth.dto;

/** Access + refresh token pair returned by login and refresh. */
public record TokenPairResponse(
        String accessToken,
        String refreshToken,
        String tokenType,
        long expiresIn) {}

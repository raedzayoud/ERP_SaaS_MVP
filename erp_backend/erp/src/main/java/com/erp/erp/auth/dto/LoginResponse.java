package com.erp.erp.auth.dto;

/** Minimal login response: the client calls /auth/me for the profile. */
public record LoginResponse(String accessToken) {}

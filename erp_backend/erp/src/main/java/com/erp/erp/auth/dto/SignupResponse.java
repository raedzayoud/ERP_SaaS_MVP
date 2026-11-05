package com.erp.erp.auth.dto;

/** The account was created; payment and administrator approval are still pending. */
public record SignupResponse(String message, String checkoutUrl) {}

package com.erp.erp.auth.dto;

/** Tells the signup wizard whether a workspace subdomain can still be used. */
public record SignupAvailabilityResponse(boolean subdomainAvailable) {}

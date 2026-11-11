package com.erp.erp.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class SecurityConfigTest {

    @Test
    void paidTrialTenantKeepsAccessAfterTrialIsExhausted() {
        assertTrue(hasFullAccess(jwt("TRIAL", "ACTIVE", "PENDING", 30, 30)));
    }

    @Test
    void unpaidExhaustedTrialHasNoFullAccess() {
        assertFalse(hasFullAccess(jwt("TRIAL", "NONE", "PENDING", 30, 30)));
    }

    @Test
    void rejectedTrialTenantHasNoFullAccessEvenWhenPaid() {
        assertFalse(hasFullAccess(jwt("TRIAL", "ACTIVE", "REJECTED", 5, 30)));
    }

    private static boolean hasFullAccess(Jwt jwt) {
        return SecurityConfig.jwtAuthenticationConverter()
                .convert(jwt)
                .getAuthorities()
                .stream()
                .anyMatch(authority -> "access:full".equals(authority.getAuthority()));
    }

    private static Jwt jwt(
            String tenantStatus, String billingStatus, String kycStatus, int trialUsed, int trialLimit) {
        return Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("owner@acme.com")
                .claim("tenantStatus", tenantStatus)
                .claim("billingStatus", billingStatus)
                .claim("kycStatus", kycStatus)
                .claim("trialUsed", trialUsed)
                .claim("trialLimit", trialLimit)
                .build();
    }
}

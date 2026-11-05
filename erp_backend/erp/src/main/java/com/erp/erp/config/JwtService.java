package com.erp.erp.config;

import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.user.model.User;
import java.time.Instant;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/**
 * Creates signed JWT tokens (HS256). The decoder lives in SecurityConfig and
 * is used by Spring Security to validate incoming requests.
 */
@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final long expirationMs;

    public JwtService(JwtEncoder jwtEncoder, @Value("${app.jwt.expiration-ms}") long expirationMs) {
        this.jwtEncoder = jwtEncoder;
        this.expirationMs = expirationMs;
    }

    public String generateToken(User user) {
        Instant now = Instant.now();

        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("erp-backend")
                .subject(user.getEmail())
                .issuedAt(now)
                .expiresAt(now.plusMillis(expirationMs))
                .claims(claimMap -> {
                    claimMap.put("userId", user.getId().toString());
                    claimMap.put("role", user.getRole().getCode());
                    claimMap.put("kycStatus", kycStatus(user));
                    claimMap.put("billingStatus", billingStatus(user));
                    if (user.getTenant() != null) {
                        claimMap.put("tenantId", user.getTenant().getId().toString());
                    }
                });

        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }

    /** The claim lets Spring Security restrict a pending signup to GET /me. */
    private String kycStatus(User user) {
        if (user.getTenant() == null || user.getTenant().getKycStatus() == null) {
            return KycStatus.APPROVED.name();
        }
        return user.getTenant().getKycStatus().name();
    }

    /** Missing billing means a legacy token or the tenant-less super-admin. */
    private String billingStatus(User user) {
        if (user.getTenant() == null || user.getTenant().getBillingStatus() == null) {
            return BillingStatus.EXEMPT.name();
        }
        return user.getTenant().getBillingStatus().name();
    }

    /** Small debug helper that exposes only a short prefix of the token. */
    public Map<String, Object> debugClaims(String token) {
        return Map.of("tokenPrefix", token.substring(0, Math.min(20, token.length())) + "...");
    }
}

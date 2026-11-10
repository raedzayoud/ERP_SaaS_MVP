package com.erp.erp.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

class JwtServiceTest {

    private static final String SECRET = "test-secret-test-secret-test-secret!!";

    private final SecretKeySpec key =
            new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    private final JwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
    private final JwtDecoder decoder = NimbusJwtDecoder
            .withSecretKey(key)
            .macAlgorithm(MacAlgorithm.HS256)
            .build();
    private final JwtService service = new JwtService(encoder, 900_000L);

    @Test
    void accessTokenContainsTheRoleAndItsPermissions() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("sales@acme.com");
        user.setRole(Role.COMMERCIAL);

        Jwt jwt = decoder.decode(service.generateToken(user));

        assertEquals("commercial", jwt.getClaimAsString("role"));
        Map<String, Object> permissions = jwt.getClaim("permissions");
        assertEquals(List.of("view", "create", "update", "delete", "validate", "export"),
                permissions.get("sales"));
        assertTrue(permissions.containsKey("dashboard"));
        assertEquals(900, service.getExpirationSeconds());
    }

    @Test
    void accessTokenContainsTrialUsageForTenantUsers() {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setEmail("owner@acme.com");
        user.setRole(Role.ADMIN_ENTREPRISE);
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setTenantStatus(TenantStatus.TRIAL);
        tenant.setTrialLimit(30);
        tenant.setTrialUsed(7);
        user.setTenant(tenant);

        Jwt jwt = decoder.decode(service.generateToken(user));

        assertEquals(7, ((Number) jwt.getClaim("trialUsed")).intValue());
        assertEquals(30, ((Number) jwt.getClaim("trialLimit")).intValue());
        assertEquals("TRIAL", jwt.getClaimAsString("tenantStatus"));
    }
}

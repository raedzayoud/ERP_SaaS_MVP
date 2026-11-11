package com.erp.erp.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.nimbusds.jose.proc.SecurityContext;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Stateless JWT security: public auth endpoints, business APIs reserved to
 * approved KYC files, admin signup review reserved to the super-admin.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final String[] PUBLIC_PATHS = {
        "/api/v1/auth/login",
        "/api/v1/auth/refresh",
        "/api/v1/auth/logout",
        "/api/v1/auth/signup",
        "/api/v1/auth/signup/availability",
        "/api/v1/auth/signup/otp/send",
        "/api/v1/auth/signup/otp/verify",
        "/api/v1/auth/forgot-password",
        "/api/v1/auth/reset-password",
        "/api/v1/webhooks/stripe",
    };

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .requestMatchers("/api/v1/auth/me").authenticated()
                        .requestMatchers("/api/v1/admin/**").hasAuthority("super-admin")
                        .requestMatchers("/api/v1/billing/**")
                                .hasAnyAuthority("kyc:pending", "kyc:approved")
                        .requestMatchers("/api/**").hasAuthority("access:full")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(oauth2 -> oauth2
                        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler(this::denyAccess));
        return http.build();
    }

    /**
     * Adds two authorities to the authenticated user:
     * - the role code as-is (e.g. "super-admin")
     * - "kyc:" + kycStatus (e.g. "kyc:pending"), defaulting to approved.
     */
    static Converter<Jwt, AbstractAuthenticationToken> jwtAuthenticationConverter() {
        return jwt -> {
            List<GrantedAuthority> authorities = new ArrayList<>();

            String role = jwt.getClaimAsString("role");
            if (role != null && !role.isBlank()) {
                authorities.add(new SimpleGrantedAuthority(role));
            }

            String kycStatus = jwt.getClaimAsString("kycStatus");
            String normalized = kycStatus == null || kycStatus.isBlank() ? "APPROVED" : kycStatus;
            authorities.add(new SimpleGrantedAuthority("kyc:" + normalized.toLowerCase(Locale.ROOT)));

            // Legacy tokens have no billingStatus: treat them as exempt so
            // existing approved users are not locked out after deployment.
            String billingStatus = jwt.getClaimAsString("billingStatus");
            String normalizedBilling =
                    billingStatus == null || billingStatus.isBlank() ? "EXEMPT" : billingStatus;

            String tenantStatus = jwt.getClaimAsString("tenantStatus");
            boolean tenantActive =
                    tenantStatus == null || !"suspended".equalsIgnoreCase(tenantStatus);

            boolean kycApproved = "approved".equalsIgnoreCase(normalized);
            boolean kycRejected = "rejected".equalsIgnoreCase(normalized);
            boolean billingOk = "active".equalsIgnoreCase(normalizedBilling)
                    || "exempt".equalsIgnoreCase(normalizedBilling);
            boolean trialActive = "trial".equalsIgnoreCase(tenantStatus)
                    && !kycRejected
                    && intClaim(jwt, "trialLimit") > 0
                    && intClaim(jwt, "trialUsed") < intClaim(jwt, "trialLimit");
            boolean paidTrial = "trial".equalsIgnoreCase(tenantStatus)
                    && !kycRejected
                    && billingOk;
            if ((kycApproved && billingOk && tenantActive) || trialActive || paidTrial) {
                authorities.add(new SimpleGrantedAuthority("access:full"));
            }

            return new JwtAuthenticationToken(jwt, authorities, jwt.getSubject());
        };
    }

    private static int intClaim(Jwt jwt, String name) {
        Object value = jwt.getClaim(name);
        return value instanceof Number number ? number.intValue() : 0;
    }

    /** Returns an explicit 403 message so the client can show the KYC state. */
    private void denyAccess(HttpServletRequest request, HttpServletResponse response, Exception ex)
            throws IOException {
        String message = "access denied";
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null) {
            boolean billingOk = false;
            boolean trialExhausted = false;
            if (authentication instanceof JwtAuthenticationToken token) {
                String billing = token.getToken().getClaimAsString("billingStatus");
                billingOk = billing == null || billing.isBlank()
                        || "active".equalsIgnoreCase(billing)
                        || "exempt".equalsIgnoreCase(billing);
                trialExhausted = "trial".equalsIgnoreCase(
                                token.getToken().getClaimAsString("tenantStatus"))
                        && !billingOk
                        && intClaim(token.getToken(), "trialUsed")
                                >= intClaim(token.getToken(), "trialLimit");
            }
            boolean pending = authentication.getAuthorities().stream()
                    .anyMatch(authority -> "kyc:pending".equals(authority.getAuthority()));
            boolean rejected = authentication.getAuthorities().stream()
                    .anyMatch(authority -> "kyc:rejected".equals(authority.getAuthority()));
            if (pending) {
                message = "registration pending approval";
            } else if (rejected) {
                message = "registration rejected";
            } else {
                boolean approved = authentication.getAuthorities().stream()
                        .anyMatch(authority -> "kyc:approved".equals(authority.getAuthority()));
                boolean fullAccess = authentication.getAuthorities().stream()
                        .anyMatch(authority -> "access:full".equals(authority.getAuthority()));
                if (approved && !fullAccess) {
                    message = "payment required";
                }
            }
            if (trialExhausted) {
                message = "trial limit reached";
            }
        }

        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"message\":\"" + message + "\"}");
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Signs tokens (HS256 symmetric key). */
    @Bean
    public JwtEncoder jwtEncoder(@Value("${app.jwt.secret}") String secret) {
        SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return new NimbusJwtEncoder(new ImmutableSecret<>(key));
    }

    /** Validates tokens arriving in the Authorization header. */
    @Bean
    public JwtDecoder jwtDecoder(@Value("${app.jwt.secret}") String secret) {
        SecretKeySpec key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
        return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(
            @Value("${app.cors.allowed-origins}") String allowedOrigins) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(java.util.Arrays.asList(allowedOrigins.split(",")));
        config.setAllowedMethods(java.util.List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(java.util.List.of("Authorization", "Content-Type", "Accept"));
        config.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}

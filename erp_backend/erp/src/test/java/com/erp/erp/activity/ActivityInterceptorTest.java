package com.erp.erp.activity;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.erp.erp.activity.model.ActivityAction;
import com.erp.erp.activity.service.ActivityService;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

class ActivityInterceptorTest {

    private static final String TENANT_ID = UUID.randomUUID().toString();
    private static final String USER_ID = UUID.randomUUID().toString();

    private final ActivityService activityService = mock(ActivityService.class);
    private final ActivityInterceptor interceptor = new ActivityInterceptor(activityService);

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void logsSuccessfulWrite() {
        Jwt jwt = authenticate();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/settings/users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(201);

        interceptor.afterCompletion(request, response, new Object(), null);

        verify(activityService)
                .logFromJwt(
                        eq(jwt),
                        eq("settings"),
                        eq(ActivityAction.CREATE),
                        eq("users"),
                        eq("users"),
                        isNull());
    }

    @Test
    void extractsEntityIdFromPath() {
        Jwt jwt = authenticate();
        String userId = UUID.randomUUID().toString();
        MockHttpServletRequest request =
                new MockHttpServletRequest("PATCH", "/api/v1/settings/users/" + userId);
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(request, response, new Object(), null);

        verify(activityService)
                .logFromJwt(
                        eq(jwt),
                        eq("settings"),
                        eq(ActivityAction.UPDATE),
                        eq("users"),
                        eq("users"),
                        eq(userId));
    }

    @Test
    void mapsBillingToSettingsModule() {
        Jwt jwt = authenticate();
        MockHttpServletRequest request =
                new MockHttpServletRequest("POST", "/api/v1/billing/checkout");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(request, response, new Object(), null);

        verify(activityService)
                .logFromJwt(
                        eq(jwt),
                        eq("settings"),
                        eq(ActivityAction.CREATE),
                        eq("checkout"),
                        eq("checkout"),
                        isNull());
    }

    @Test
    void ignoresReads() {
        authenticate();
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/settings/users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(200);

        interceptor.afterCompletion(request, response, new Object(), null);

        verifyNoInteractions(activityService);
    }

    @Test
    void ignoresFailedWrites() {
        authenticate();
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/settings/users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(400);

        interceptor.afterCompletion(request, response, new Object(), null);

        verifyNoInteractions(activityService);
    }

    @Test
    void ignoresAuthAdminAndWebhookWrites() {
        authenticate();
        for (String path :
                new String[] {
                    "/api/v1/auth/logout",
                    "/api/v1/admin/tenants/" + TENANT_ID + "/approve",
                    "/api/v1/webhooks/stripe",
                    "/api/v1/billing/refresh"
                }) {
            MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
            MockHttpServletResponse response = new MockHttpServletResponse();
            response.setStatus(200);
            interceptor.afterCompletion(request, response, new Object(), null);
        }

        verifyNoInteractions(activityService);
    }

    @Test
    void ignoresRequestsWithoutJwt() {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/settings/users");
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.setStatus(201);

        interceptor.afterCompletion(request, response, new Object(), null);

        verifyNoInteractions(activityService);
    }

    private Jwt authenticate() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("owner@acme.com")
                .claim("tenantId", TENANT_ID)
                .claim("userId", USER_ID)
                .claim("name", "Amira")
                .claim("role", "admin-entreprise")
                .build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
        return jwt;
    }
}

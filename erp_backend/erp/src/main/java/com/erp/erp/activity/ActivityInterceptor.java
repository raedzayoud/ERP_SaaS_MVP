package com.erp.erp.activity;

import com.erp.erp.activity.model.ActivityAction;
import com.erp.erp.activity.service.ActivityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Records successful writes (POST/PUT/PATCH/DELETE) after the request finishes.
 * Reads, failed requests and infrastructure endpoints are ignored.
 */
@Component
public class ActivityInterceptor implements HandlerInterceptor {

    private static final Logger log = LoggerFactory.getLogger(ActivityInterceptor.class);

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final Set<String> SKIPPED_PREFIXES =
            Set.of("/api/v1/auth/", "/api/v1/admin/", "/api/v1/webhooks/");
    private static final String API_PREFIX = "/api/v1/";
    private static final String UUID_PATTERN =
            "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";

    private final ActivityService activityService;

    public ActivityInterceptor(ActivityService activityService) {
        this.activityService = activityService;
    }

    @Override
    public void afterCompletion(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler,
            Exception ex) {
        if (ex != null
                || !MUTATING_METHODS.contains(request.getMethod())
                || response.getStatus() < 200
                || response.getStatus() >= 300) {
            return;
        }

        String path = request.getRequestURI();
        if (!path.startsWith(API_PREFIX) || isSkipped(path)) {
            return;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token)) {
            return;
        }
        Jwt jwt = token.getToken();

        String[] segments = path.substring(API_PREFIX.length()).split("/");
        String module = segments.length > 0 ? module(segments[0]) : "settings";
        String entityType = segments.length > 1 ? segments[1] : null;
        String entityId = entityId(segments);

        try {
            activityService.logFromJwt(
                    jwt,
                    module,
                    action(request.getMethod()),
                    entityType,
                    entityType,
                    entityId);
        } catch (RuntimeException logError) {
            log.warn("Activity log failed for {} {}", request.getMethod(), path, logError);
        }
    }

    private static boolean isSkipped(String path) {
        if (SKIPPED_PREFIXES.stream().anyMatch(path::startsWith)) {
            return true;
        }
        return path.equals("/api/v1/billing/refresh");
    }

    private static String module(String segment) {
        // The CRM routes live under /crm but belong to the "contacts" module.
        if ("billing".equals(segment)) {
            return "settings";
        }
        if ("crm".equals(segment)) {
            return "contacts";
        }
        return segment;
    }

    private static String entityId(String[] segments) {
        if (segments.length <= 2) {
            return null;
        }
        String candidate = segments[2];
        return candidate.matches(UUID_PATTERN) ? candidate : null;
    }

    private static ActivityAction action(String method) {
        // shortcut: every POST is CREATE (approve/validate endpoints included); refine with annotations when needed.
        if ("POST".equals(method)) {
            return ActivityAction.CREATE;
        }
        if ("DELETE".equals(method)) {
            return ActivityAction.DELETE;
        }
        return ActivityAction.UPDATE;
    }
}

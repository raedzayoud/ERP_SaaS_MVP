package com.erp.erp.activity.service;

import com.erp.erp.activity.dto.ActivityResponse;
import com.erp.erp.activity.model.ActivityAction;
import com.erp.erp.activity.model.ActivityLog;
import com.erp.erp.activity.repository.ActivityLogRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Writes and reads the tenant-scoped audit journal. */
@Service
public class ActivityService {

    private static final int MAX_LIMIT = 50;

    private final ActivityLogRepository repository;

    public ActivityService(ActivityLogRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void log(
            UUID tenantId,
            UUID actorId,
            String actorName,
            String actorEmail,
            String actorRole,
            String module,
            ActivityAction action,
            String detail,
            String entityType,
            String entityId) {
        if (tenantId == null) {
            return;
        }

        ActivityLog entry = new ActivityLog();
        entry.setTenantId(tenantId);
        entry.setActorId(actorId);
        entry.setActorName(actorName == null || actorName.isBlank() ? "Unknown" : actorName);
        entry.setActorEmail(actorEmail == null ? "" : actorEmail);
        entry.setActorRole(actorRole);
        entry.setModule(module);
        entry.setAction(action);
        entry.setDetail(detail);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        repository.save(entry);
    }

    /** Logs one successful action using the claims of the caller. */
    public void logFromJwt(
            Jwt jwt,
            String module,
            ActivityAction action,
            String detail,
            String entityType,
            String entityId) {
        String email = jwt.getSubject();
        String name = jwt.getClaimAsString("name");
        log(
                parseUuid(jwt.getClaimAsString("tenantId")),
                parseUuid(jwt.getClaimAsString("userId")),
                name == null || name.isBlank() ? email : name,
                email,
                jwt.getClaimAsString("role"),
                module,
                action,
                detail,
                entityType,
                entityId);
    }

    @Transactional(readOnly = true)
    public List<ActivityResponse> recent(UUID tenantId, int limit) {
        int size = Math.max(1, Math.min(limit, MAX_LIMIT));
        return repository
                .findByTenantIdOrderByCreatedAtDesc(tenantId, PageRequest.of(0, size))
                .stream()
                .map(ActivityResponse::from)
                .toList();
    }

    private static UUID parseUuid(String value) {
        try {
            return value == null ? null : UUID.fromString(value);
        } catch (IllegalArgumentException invalid) {
            return null;
        }
    }
}

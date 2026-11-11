package com.erp.erp.activity.dto;

import com.erp.erp.activity.model.ActivityLog;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

public record ActivityResponse(
        UUID id,
        Instant at,
        String userName,
        String userEmail,
        String module,
        String action,
        String detail,
        String entityType,
        String entityId) {

    public static ActivityResponse from(ActivityLog log) {
        return new ActivityResponse(
                log.getId(),
                log.getCreatedAt(),
                log.getActorName(),
                log.getActorEmail(),
                log.getModule(),
                log.getAction().name().toLowerCase(Locale.ROOT),
                log.getDetail(),
                log.getEntityType(),
                log.getEntityId());
    }
}

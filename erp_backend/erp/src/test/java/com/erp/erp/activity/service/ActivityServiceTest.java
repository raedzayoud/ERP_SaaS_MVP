package com.erp.erp.activity.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.activity.dto.ActivityResponse;
import com.erp.erp.activity.model.ActivityAction;
import com.erp.erp.activity.model.ActivityLog;
import com.erp.erp.activity.repository.ActivityLogRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Pageable;
import org.springframework.security.oauth2.jwt.Jwt;

class ActivityServiceTest {

    private final ActivityLogRepository repository = mock(ActivityLogRepository.class);
    private final ActivityService service = new ActivityService(repository);

    @Test
    void logSkipsRequestsWithoutTenant() {
        service.log(
                null,
                UUID.randomUUID(),
                "Amira",
                "owner@acme.com",
                "admin-entreprise",
                "settings",
                ActivityAction.CREATE,
                "users",
                "users",
                null);

        verify(repository, never()).save(any());
    }

    @Test
    void logStoresActorAndAction() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();

        service.log(
                tenantId,
                actorId,
                "Amira",
                "owner@acme.com",
                "admin-entreprise",
                "settings",
                ActivityAction.CREATE,
                "users",
                "users",
                "user-1");

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        ActivityLog entry = captor.getValue();
        assertEquals(tenantId, entry.getTenantId());
        assertEquals(actorId, entry.getActorId());
        assertEquals("Amira", entry.getActorName());
        assertEquals(ActivityAction.CREATE, entry.getAction());
        assertEquals("users", entry.getEntityType());
    }

    @Test
    void logFromJwtUsesClaims() {
        UUID tenantId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "HS256")
                .subject("owner@acme.com")
                .claim("tenantId", tenantId.toString())
                .claim("userId", actorId.toString())
                .claim("name", "Amira")
                .claim("role", "admin-entreprise")
                .build();

        service.logFromJwt(jwt, "settings", ActivityAction.UPDATE, "users", "users", null);

        ArgumentCaptor<ActivityLog> captor = ArgumentCaptor.forClass(ActivityLog.class);
        verify(repository).save(captor.capture());
        assertEquals(tenantId, captor.getValue().getTenantId());
        assertEquals(actorId, captor.getValue().getActorId());
        assertEquals("Amira", captor.getValue().getActorName());
        assertEquals("owner@acme.com", captor.getValue().getActorEmail());
    }

    @Test
    void recentClampsLimitAndMapsRows() {
        UUID tenantId = UUID.randomUUID();
        ActivityLog row = new ActivityLog();
        row.setId(UUID.randomUUID());
        row.setCreatedAt(Instant.now());
        row.setActorName("Amira");
        row.setActorEmail("owner@acme.com");
        row.setModule("settings");
        row.setAction(ActivityAction.UPDATE);
        when(repository.findByTenantIdOrderByCreatedAtDesc(eq(tenantId), any(Pageable.class)))
                .thenReturn(List.of(row));

        List<ActivityResponse> result = service.recent(tenantId, 200);

        assertEquals(1, result.size());
        assertEquals("update", result.get(0).action());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findByTenantIdOrderByCreatedAtDesc(eq(tenantId), page.capture());
        assertEquals(50, page.getValue().getPageSize());
    }
}

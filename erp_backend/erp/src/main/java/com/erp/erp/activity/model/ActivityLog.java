package com.erp.erp.activity.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One audit row: who did what, in which module, and when. */
@Entity
@Table(
        name = "activity_logs",
        indexes = @Index(name = "idx_activity_tenant_created", columnList = "tenant_id, created_at"))
@Getter
@Setter
@NoArgsConstructor
public class ActivityLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_name", nullable = false, length = 120)
    private String actorName;

    @Column(name = "actor_email", nullable = false, length = 180)
    private String actorEmail;

    @Column(name = "actor_role", length = 40)
    private String actorRole;

    @Column(nullable = false, length = 40)
    private String module;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ActivityAction action;

    @Column(length = 120)
    private String detail;

    @Column(name = "entity_type", length = 80)
    private String entityType;

    @Column(name = "entity_id", length = 80)
    private String entityId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}

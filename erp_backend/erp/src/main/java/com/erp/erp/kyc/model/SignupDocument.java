package com.erp.erp.kyc.model;

import com.erp.erp.tenant.model.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One file uploaded during the signup KYC step (stored on the local filesystem). */
@Entity
@Table(
        name = "signup_documents",
        uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "slot"}))
@Getter
@Setter
@NoArgsConstructor
public class SignupDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DocumentSlot slot;

    @Column(nullable = false)
    private String originalFileName;

    @Column(nullable = false)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    /** Path relative to app.kyc.storage-dir, e.g. "5/idCardRecto.png". */
    @Column(nullable = false, length = 500)
    private String storagePath;

    @Column(nullable = false)
    private Instant uploadedAt = Instant.now();
}

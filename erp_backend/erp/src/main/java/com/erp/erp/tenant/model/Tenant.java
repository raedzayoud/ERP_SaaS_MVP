package com.erp.erp.tenant.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * A company workspace (the "tenant" in multi-tenant SaaS).
 * enabledModules is stored as a comma-separated string ("dashboard,sales,...")
 * to keep the schema simple; getModuleList() splits it back.
 */
@Entity
@Table(name = "tenants")
@Getter
@Setter
@NoArgsConstructor
public class Tenant {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String companyName;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, unique = true)
    private String subdomain;

    @Column(nullable = false)
    private String country;

    @Column(nullable = false)
    private String language;

    @Column(nullable = false)
    private String companySize;

    /** Plan id: starter | business | enterprise (same ids as the Angular app). */
    @Column(nullable = false)
    private String planId;

    /** Comma-separated module ids, e.g. "dashboard,contacts,products". */
    @Column(length = 2000)
    private String enabledModules;

    /**
     * KYC validation state. The SQL default keeps existing companies working
     * when the column is added by ddl-auto=update.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'APPROVED'")
    private KycStatus kycStatus = KycStatus.APPROVED;

    /** Super-admin note written when the signup is rejected. */
    @Column(length = 500)
    private String decisionNote;

    private Instant decidedAt;

    @Column(nullable = false)
    private String currency = "USD";

    private String taxId;

    private String address;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    public List<String> getModuleList() {
        if (enabledModules == null || enabledModules.isBlank()) {
            return List.of();
        }
        return Arrays.stream(enabledModules.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    public void setModuleList(List<String> modules) {
        this.enabledModules = String.join(",", modules);
    }
}

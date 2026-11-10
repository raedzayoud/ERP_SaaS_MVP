package com.erp.erp.tenant.model;

import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
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

    /** Platform lifecycle state; new signups start in trial until KYC approval. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'ACTIVE'")
    private TenantStatus tenantStatus = TenantStatus.ACTIVE;

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

    /** Free connections included in trial mode. */
    @Column(nullable = false, columnDefinition = "integer default 30")
    private int trialLimit = 30;

    /** Successful logins consumed during the trial. */
    @Column(nullable = false, columnDefinition = "integer default 0")
    private int trialUsed = 0;

    private Instant trialStartedAt;

    /** Set when the last trial connection is consumed. */
    private Instant trialEndedAt;

    /** Super-admin note written when the signup is rejected. */
    @Column(length = 500)
    private String decisionNote;

    private Instant decidedAt;

    /**
     * Existing companies are exempt from billing. New signups explicitly start
     * with NONE and must complete Stripe Checkout before KYC approval.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20, columnDefinition = "varchar(20) default 'EXEMPT'")
    private BillingStatus billingStatus = BillingStatus.NONE;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private BillingInterval billingInterval;

    @Column(unique = true)
    private String stripeCustomerId;

    @Column(unique = true)
    private String stripeSubscriptionId;

    private Instant currentPeriodEnd;

    @Column(nullable = false, columnDefinition = "boolean default false")
    private boolean cancelAtPeriodEnd = false;

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

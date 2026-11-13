package com.erp.erp.crm.model;

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
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A customer or supplier contact; a person can point to its company. */
@Entity
@Table(name = "crm_partners")
@Getter
@Setter
@NoArgsConstructor
public class CrmPartner {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private PartnerKind kind = PartnerKind.COMPANY;

    @Column(nullable = false)
    private String name;

    /** Id of the company a person belongs to. */
    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "is_customer", nullable = false)
    private boolean customer = false;

    @Column(name = "is_supplier", nullable = false)
    private boolean supplier = false;

    @Column(name = "tax_id")
    private String taxId;

    private String email;
    private String phone;

    @Column(name = "job_title")
    private String jobTitle;

    @Column(name = "address_street")
    private String addressStreet;

    @Column(name = "address_city")
    private String addressCity;

    @Column(name = "address_country")
    private String addressCountry;

    /** Archived contacts stay in the database but are hidden by default. */
    @Column(nullable = false)
    private boolean active = true;

    @Column(length = 2000)
    private String notes;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}

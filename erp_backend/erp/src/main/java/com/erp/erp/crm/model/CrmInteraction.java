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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A call, email, meeting or note recorded on a contact. */
@Entity
@Table(name = "crm_interactions")
@Getter
@Setter
@NoArgsConstructor
public class CrmInteraction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(name = "partner_id", nullable = false)
    private UUID partnerId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private InteractionType type = InteractionType.NOTE;

    @Column(name = "interaction_date", nullable = false)
    private LocalDate date = LocalDate.now();

    @Column(nullable = false)
    private String subject;

    @Column(length = 2000)
    private String notes;

    @Column(name = "reminder_at")
    private LocalDate reminderAt;

    @Column(name = "reminder_done", nullable = false)
    private boolean reminderDone = false;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();
}

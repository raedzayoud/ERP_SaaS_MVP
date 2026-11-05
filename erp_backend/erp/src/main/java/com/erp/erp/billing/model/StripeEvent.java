package com.erp.erp.billing.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** Keeps processed webhook event ids so Stripe retries do not apply twice. */
@Entity
@Table(name = "stripe_events")
@Getter
@Setter
@NoArgsConstructor
public class StripeEvent {

    @Id
    private String id;

    @Column(nullable = false)
    private String type;

    @Column(nullable = false)
    private Instant processedAt = Instant.now();

    public StripeEvent(String id, String type) {
        this.id = id;
        this.type = type;
    }
}

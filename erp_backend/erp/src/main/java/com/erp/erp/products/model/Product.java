package com.erp.erp.products.model;

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
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A product or a service of the catalog. */
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Column(nullable = false)
    private String sku;

    @Column(nullable = false)
    private String name;

    @Column(length = 2000)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductType type = ProductType.GOOD;

    /** Unit of measure: piece, hour, day, kg, litre, box, month. */
    @Column(nullable = false, length = 20)
    private String unit = "piece";

    /** Catalog category: hardware, services, consumables, other. */
    @Column(nullable = false, length = 40)
    private String category = "hardware";

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal salePrice = BigDecimal.ZERO;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal purchasePrice = BigDecimal.ZERO;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal vatRate = BigDecimal.ZERO;

    /** Reordering threshold; only goods are tracked in the stock. */
    @Column(nullable = false, precision = 14, scale = 3)
    private BigDecimal minStock = BigDecimal.ZERO;

    /**
     * Quantity the product was created with. The journal of movements stays the
     * source of truth for the stock on hand; this column is the trace of the
     * opening quantity.
     * shortcut: the default is required, Hibernate cannot add a not null
     * column to a table that already holds rows; drop it when migrations
     * replace ddl-auto.
     */
    @Column(
            name = "opening_quantity",
            nullable = false,
            precision = 14,
            scale = 3,
            columnDefinition = "numeric(14,3) default 0")
    private BigDecimal openingQuantity = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();
}

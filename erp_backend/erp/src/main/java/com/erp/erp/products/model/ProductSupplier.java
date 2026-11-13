package com.erp.erp.products.model;

import com.erp.erp.tenant.model.Tenant;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A supplier of the product: which contact sells it and at which price. */
@Entity
@Table(name = "product_suppliers")
@Getter
@Setter
@NoArgsConstructor
public class ProductSupplier {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    /** Id of the contact that supplies the product. */
    @Column(name = "supplier_id", nullable = false)
    private UUID supplierId;

    @Column(name = "supplier_ref")
    private String supplierRef;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(name = "min_qty", nullable = false)
    private int minQty = 1;

    @Column(name = "delay_days", nullable = false)
    private int delayDays = 0;

    /** Keeps the order of the supplier list sent by the client. */
    @Column(nullable = false)
    private int position = 0;
}

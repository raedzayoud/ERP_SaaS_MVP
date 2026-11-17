package com.erp.erp.purchases.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.purchases.dto.PurchaseOrderRequest;
import com.erp.erp.purchases.dto.PurchaseOrderResponse;
import com.erp.erp.purchases.dto.PurchaseReceptionRequest;
import com.erp.erp.purchases.dto.PurchaseSummaryResponse;
import com.erp.erp.products.repository.ProductRepository;
import com.erp.erp.stock.model.StockMovement;
import com.erp.erp.stock.repository.StockMovementRepository;
import com.erp.erp.stock.repository.WarehouseRepository;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checks the purchase orders against the real database: the mapping, the
 * numbering and the reception that moves the stock.
 */
@SpringBootTest
class PurchaseOrderPersistenceTest {

    @Autowired private PurchaseOrderService service;
    @Autowired private TenantRepository tenants;
    @Autowired private CrmPartnerRepository partners;
    @Autowired private ProductRepository products;
    @Autowired private WarehouseRepository warehouses;
    @Autowired private StockMovementRepository movements;

    @Test
    @Transactional
    void createsConfirmsAndReceivesAnOrder() {
        Tenant tenant = tenantWithCatalog();
        CrmPartner supplier =
                partners.findByTenantIdOrderByNameAsc(tenant.getId()).stream()
                        .filter(CrmPartner::isSupplier)
                        .findFirst()
                        .orElseThrow();
        UUID productId = products.findByTenantIdOrderByNameAsc(tenant.getId()).get(0).getId();
        String warehouseId =
                warehouses.findByTenantIdOrderByCodeAsc(tenant.getId()).get(0).getId().toString();

        PurchaseOrderResponse created =
                service.create(
                        tenant,
                        new PurchaseOrderRequest(
                                supplier.getId().toString(),
                                LocalDate.of(2026, 5, 10),
                                LocalDate.of(2026, 5, 20),
                                "net30",
                                "USD",
                                "persistence check",
                                List.of(
                                        new PurchaseOrderRequest.Line(
                                                productId.toString(),
                                                "SKU-CHECK",
                                                "Check line",
                                                "piece",
                                                new BigDecimal("10"),
                                                new BigDecimal("15.00"),
                                                BigDecimal.ZERO,
                                                new BigDecimal("19")))));

        assertEquals("draft", created.status());
        assertEquals(supplier.getName(), created.supplierSnapshot().name());

        PurchaseOrderResponse confirmed = service.confirm(tenant, created.id());
        assertEquals("confirmed", confirmed.status());
        assertNotNull(confirmed.number());
        assertTrue(confirmed.number().startsWith("BC-2026-"));

        PurchaseOrderResponse received =
                service.receive(
                        tenant,
                        created.id(),
                        new PurchaseReceptionRequest(
                                LocalDate.of(2026, 5, 18),
                                "BL-CHECK",
                                warehouseId,
                                List.of(
                                        new PurchaseReceptionRequest.Item(
                                                confirmed.lines().get(0).id().toString(),
                                                new BigDecimal("4")))));

        assertEquals(1, received.receptions().size());
        assertEquals(0, received.lines().get(0).receivedQty().compareTo(new BigDecimal("4")));

        PurchaseSummaryResponse summary = service.summary(tenant);
        assertTrue(summary.awaiting() >= 1);

        List<StockMovement> journal =
                movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId());
        assertTrue(journal.stream().anyMatch(m -> created.id().toString().equals(m.getRefId())));
    }

    /** The first tenant that has products, a supplier and a warehouse. */
    private Tenant tenantWithCatalog() {
        return tenants.findAll().stream()
                .filter(t -> !products.findByTenantIdOrderByNameAsc(t.getId()).isEmpty())
                .filter(t -> !warehouses.findByTenantIdOrderByCodeAsc(t.getId()).isEmpty())
                .findFirst()
                .orElseThrow();
    }
}

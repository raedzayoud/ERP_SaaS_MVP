package com.erp.erp.stock.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.products.model.Product;
import com.erp.erp.products.model.ProductType;
import com.erp.erp.products.repository.ProductRepository;
import com.erp.erp.stock.dto.MovementRequest;
import com.erp.erp.stock.dto.MovementResponse;
import com.erp.erp.stock.dto.SalePostingRequest;
import com.erp.erp.stock.dto.StockItemRequest;
import com.erp.erp.stock.dto.StockLevelResponse;
import com.erp.erp.stock.dto.TransferRequest;
import com.erp.erp.stock.dto.WarehouseRequest;
import com.erp.erp.stock.model.MovementDirection;
import com.erp.erp.stock.model.MovementType;
import com.erp.erp.stock.model.StockMovement;
import com.erp.erp.stock.model.Warehouse;
import com.erp.erp.stock.repository.StockMovementRepository;
import com.erp.erp.stock.repository.WarehouseRepository;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class StockServiceTest {

    private final WarehouseRepository warehouses = mock(WarehouseRepository.class);
    private final StockMovementRepository movements = mock(StockMovementRepository.class);
    private final ProductRepository products = mock(ProductRepository.class);
    private final StockService service = new StockService(warehouses, movements, products);

    @Test
    void computesTheStockLevelsFromTheJournal() {
        Tenant tenant = tenant();
        Product laptop = good(tenant, "Laptop");
        Warehouse main = warehouse(tenant, "MAIN", true);
        when(products.findByTenantIdOrderByNameAsc(tenant.getId())).thenReturn(List.of(laptop));
        when(movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(in(tenant, laptop, main, "10")));

        List<StockLevelResponse> levels = service.levels(tenant, null, null);

        assertEquals(1, levels.size());
        assertEquals(0, new BigDecimal("10.000").compareTo(levels.get(0).quantity()));
        assertEquals(0, new BigDecimal("1000.00").compareTo(levels.get(0).value()));
        assertEquals(false, levels.get(0).low());
    }

    @Test
    void flagsTheProductsUnderTheirThreshold() {
        Tenant tenant = tenant();
        Product laptop = good(tenant, "Laptop");
        Warehouse main = warehouse(tenant, "MAIN", true);
        when(products.findByTenantIdOrderByNameAsc(tenant.getId())).thenReturn(List.of(laptop));
        when(movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(in(tenant, laptop, main, "2")));

        List<StockLevelResponse> low = service.lowStock(tenant);

        assertEquals(1, low.size());
        assertEquals(true, low.get(0).low());
    }

    @Test
    void refusesAnAdjustmentOnAService() {
        Tenant tenant = tenant();
        Product support = new Product();
        support.setId(UUID.randomUUID());
        support.setTenant(tenant);
        support.setName("Support");
        support.setType(ProductType.SERVICE);
        support.setActive(true);
        Warehouse main = warehouse(tenant, "MAIN", true);
        when(products.findByIdAndTenantId(support.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(support));
        when(warehouses.findByIdAndTenantId(main.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(main));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.adjustment(
                                        tenant,
                                        new MovementRequest(
                                                "in",
                                                support.getId().toString(),
                                                main.getId().toString(),
                                                new BigDecimal("1"),
                                                LocalDate.of(2026, 10, 21),
                                                "Opening")));

        assertEquals(400, ex.getStatus());
        assertEquals("notStockedProduct", ex.getCode());
        verify(movements, never()).save(any(StockMovement.class));
    }

    @Test
    void refusesAnAdjustmentWithoutReason() {
        Tenant tenant = tenant();

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.adjustment(
                                        tenant,
                                        new MovementRequest(
                                                "in",
                                                UUID.randomUUID().toString(),
                                                UUID.randomUUID().toString(),
                                                new BigDecimal("1"),
                                                LocalDate.of(2026, 10, 21),
                                                "  ")));

        assertEquals(400, ex.getStatus());
        assertEquals("missingReason", ex.getCode());
    }

    @Test
    void refusesATransferBiggerThanTheSourceStock() {
        Tenant tenant = tenant();
        Product laptop = good(tenant, "Laptop");
        Warehouse main = warehouse(tenant, "MAIN", true);
        Warehouse second = warehouse(tenant, "SFX", true);
        when(products.findByIdAndTenantId(laptop.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(laptop));
        when(warehouses.findByIdAndTenantId(main.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(main));
        when(warehouses.findByIdAndTenantId(second.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(second));
        when(movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(in(tenant, laptop, main, "3")));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.transfer(
                                        tenant,
                                        new TransferRequest(
                                                laptop.getId().toString(),
                                                main.getId().toString(),
                                                second.getId().toString(),
                                                new BigDecimal("5"),
                                                LocalDate.of(2026, 10, 21),
                                                "Moving stock")));

        assertEquals(409, ex.getStatus());
        assertEquals("insufficientStock", ex.getCode());
    }

    @Test
    void movesTheStockWithTwoMovements() {
        Tenant tenant = tenant();
        Product laptop = good(tenant, "Laptop");
        Warehouse main = warehouse(tenant, "MAIN", true);
        Warehouse second = warehouse(tenant, "SFX", true);
        when(products.findByIdAndTenantId(laptop.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(laptop));
        when(warehouses.findByIdAndTenantId(main.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(main));
        when(warehouses.findByIdAndTenantId(second.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(second));
        when(movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(in(tenant, laptop, main, "8")));
        when(movements.save(any(StockMovement.class))).thenAnswer(call -> call.getArgument(0));

        List<MovementResponse> created =
                service.transfer(
                        tenant,
                        new TransferRequest(
                                laptop.getId().toString(),
                                main.getId().toString(),
                                second.getId().toString(),
                                new BigDecimal("4"),
                                LocalDate.of(2026, 10, 21),
                                "Moving stock"));

        assertEquals(2, created.size());
        assertEquals("out", created.get(0).direction());
        assertEquals("in", created.get(1).direction());
        assertEquals("Transfer to SFX Warehouse", created.get(0).reason());
    }

    @Test
    void blocksASalePostingWithoutEnoughStock() {
        Tenant tenant = tenant();
        Product laptop = good(tenant, "Laptop");
        Warehouse main = warehouse(tenant, "MAIN", true);
        when(products.findByTenantIdOrderByNameAsc(tenant.getId())).thenReturn(List.of(laptop));
        when(products.findByIdAndTenantId(laptop.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(laptop));
        when(warehouses.findByIdAndTenantId(main.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(main));
        when(movements.findByTenantIdOrderByDateDescCreatedAtDesc(tenant.getId()))
                .thenReturn(List.of(in(tenant, laptop, main, "1")));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.salePosting(
                                        tenant,
                                        new SalePostingRequest(
                                                "FAC-1",
                                                LocalDate.of(2026, 10, 21),
                                                main.getId().toString(),
                                                List.of(
                                                        new StockItemRequest(
                                                                laptop.getId().toString(),
                                                                new BigDecimal("5"))))));

        assertEquals(409, ex.getStatus());
        assertEquals("insufficientStock", ex.getCode());
        verify(movements, never()).save(any(StockMovement.class));
    }

    @Test
    void rejectsADuplicatedWarehouseCode() {
        Tenant tenant = tenant();
        when(warehouses.existsByTenantIdAndCodeIgnoreCase(tenant.getId(), "MAIN")).thenReturn(true);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.createWarehouse(
                                        tenant, new WarehouseRequest(" main ", "Main warehouse")));

        assertEquals(409, ex.getStatus());
        assertEquals("warehouseExists", ex.getCode());
    }

    @Test
    void refusesToArchiveTheLastActiveWarehouse() {
        Tenant tenant = tenant();
        Warehouse main = warehouse(tenant, "MAIN", true);
        when(warehouses.findByIdAndTenantId(main.getId(), tenant.getId()))
                .thenReturn(java.util.Optional.of(main));
        when(warehouses.countByTenantIdAndActiveTrue(tenant.getId())).thenReturn(1L);

        AuthException ex =
                assertThrows(AuthException.class, () -> service.archiveWarehouse(tenant, main.getId()));

        assertEquals(409, ex.getStatus());
        assertEquals("lastActiveWarehouse", ex.getCode());
    }

    private Product good(Tenant tenant, String name) {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setTenant(tenant);
        product.setName(name);
        product.setSku("SKU-1");
        product.setType(ProductType.GOOD);
        product.setUnit("piece");
        product.setPurchasePrice(new BigDecimal("100.00"));
        product.setMinStock(new BigDecimal("5.000"));
        product.setActive(true);
        return product;
    }

    private Warehouse warehouse(Tenant tenant, String code, boolean active) {
        Warehouse warehouse = new Warehouse();
        warehouse.setId(UUID.randomUUID());
        warehouse.setTenant(tenant);
        warehouse.setCode(code);
        warehouse.setName(code + " Warehouse");
        warehouse.setActive(active);
        return warehouse;
    }

    private StockMovement in(
            Tenant tenant, Product product, Warehouse warehouse, String quantity) {
        StockMovement movement = new StockMovement();
        movement.setTenant(tenant);
        movement.setType(MovementType.ADJUSTMENT);
        movement.setDirection(MovementDirection.IN);
        movement.setProductId(product.getId());
        movement.setWarehouseId(warehouse.getId());
        movement.setQuantity(new BigDecimal(quantity));
        movement.setDate(LocalDate.of(2026, 10, 21));
        movement.setReason("Opening inventory");
        return movement;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

package com.erp.erp.purchases.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.purchases.dto.PurchaseOrderRequest;
import com.erp.erp.purchases.dto.PurchaseOrderResponse;
import com.erp.erp.purchases.dto.PurchaseReceptionRequest;
import com.erp.erp.purchases.dto.PurchaseSummaryResponse;
import com.erp.erp.purchases.model.PurchaseOrder;
import com.erp.erp.purchases.model.PurchaseOrderLine;
import com.erp.erp.purchases.model.PurchaseStatus;
import com.erp.erp.purchases.repository.PurchaseOrderRepository;
import com.erp.erp.stock.dto.ReceptionRequest;
import com.erp.erp.stock.service.StockService;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PurchaseOrderServiceTest {

    private final PurchaseOrderRepository orders = mock(PurchaseOrderRepository.class);
    private final CrmPartnerRepository partners = mock(CrmPartnerRepository.class);
    private final StockService stock = mock(StockService.class);
    private final PurchaseOrderService service =
            new PurchaseOrderService(orders, partners, stock);

    @Test
    void createsADraftWithItsLines() {
        Tenant tenant = tenant();
        givenSupplier(tenant, true);
        when(orders.save(any(PurchaseOrder.class))).thenAnswer(call -> call.getArgument(0));

        PurchaseOrderResponse response = service.create(tenant, request(tenant, "2026-05-20"));

        assertEquals("draft", response.status());
        assertNull(response.number());
        assertEquals(1, response.lines().size());
        assertEquals("Mouse", response.lines().get(0).description());
    }

    @Test
    void refusesAnExpectedDateBeforeTheOrderDate() {
        Tenant tenant = tenant();
        givenSupplier(tenant, true);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request(tenant, "2026-05-01")));

        assertEquals(400, ex.getStatus());
        assertEquals("expectedDateBeforeOrder", ex.getCode());
    }

    @Test
    void refusesAnOrderWithoutLines() {
        Tenant tenant = tenant();
        givenSupplier(tenant, true);
        PurchaseOrderRequest request =
                new PurchaseOrderRequest(
                        supplierId().toString(),
                        LocalDate.of(2026, 5, 10),
                        LocalDate.of(2026, 5, 20),
                        "net30",
                        "USD",
                        "",
                        List.of());

        AuthException ex =
                assertThrows(AuthException.class, () -> service.create(tenant, request));

        assertEquals(400, ex.getStatus());
        assertEquals("noLines", ex.getCode());
    }

    @Test
    void refusesAContactThatIsNotASupplier() {
        Tenant tenant = tenant();
        givenSupplier(tenant, false);

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.create(tenant, request(tenant, "2026-05-20")));

        assertEquals(400, ex.getStatus());
        assertEquals("missingSupplier", ex.getCode());
    }

    @Test
    void confirmsAnOrderAndGivesItItsNumber() {
        Tenant tenant = tenant();
        givenSupplier(tenant, true);
        PurchaseOrder order = order(tenant, PurchaseStatus.DRAFT);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));
        when(orders.findByTenantIdAndNumberStartingWith(tenant.getId(), "BC-2026-"))
                .thenReturn(List.of());
        when(orders.save(any(PurchaseOrder.class))).thenAnswer(call -> call.getArgument(0));

        PurchaseOrderResponse response = service.confirm(tenant, order.getId());

        assertEquals("confirmed", response.status());
        assertEquals("BC-2026-0001", response.number());
        assertEquals("Nord Industries", response.supplierSnapshot().name());
    }

    @Test
    void refusesToEditAConfirmedOrder() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.update(tenant, order.getId(), request(tenant, "2026-05-20")));

        assertEquals(409, ex.getStatus());
        assertEquals("notDraft", ex.getCode());
    }

    @Test
    void refusesToCancelAnOrderThatHasReceptions() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        order.getReceptions().add(new com.erp.erp.purchases.model.PurchaseReception());
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));

        AuthException ex =
                assertThrows(
                        AuthException.class, () -> service.cancel(tenant, order.getId()));

        assertEquals(409, ex.getStatus());
        assertEquals("hasReceptions", ex.getCode());
    }

    @Test
    void receivesAnOrderAndMovesTheStock() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));
        when(orders.save(any(PurchaseOrder.class))).thenAnswer(call -> call.getArgument(0));

        PurchaseOrderResponse response =
                service.receive(
                        tenant,
                        order.getId(),
                        new PurchaseReceptionRequest(
                                LocalDate.of(2026, 5, 18),
                                "BL-7781",
                                UUID.randomUUID().toString(),
                                List.of(
                                        new PurchaseReceptionRequest.Item(
                                                order.getLines().get(0).getId().toString(),
                                                new BigDecimal("5")))));

        assertEquals(1, response.receptions().size());
        assertEquals(new BigDecimal("5"), response.lines().get(0).receivedQty());

        ArgumentCaptor<ReceptionRequest> captor = ArgumentCaptor.forClass(ReceptionRequest.class);
        verify(stock).reception(eq(tenant), captor.capture());
        assertEquals("BL-7781", captor.getValue().blNumber());
        assertEquals(1, captor.getValue().items().size());
    }

    @Test
    void refusesToReceiveMoreThanOrdered() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.receive(
                                        tenant,
                                        order.getId(),
                                        new PurchaseReceptionRequest(
                                                LocalDate.of(2026, 5, 18),
                                                "BL-7781",
                                                UUID.randomUUID().toString(),
                                                List.of(
                                                        new PurchaseReceptionRequest.Item(
                                                                order.getLines()
                                                                        .get(0)
                                                                        .getId()
                                                                        .toString(),
                                                                new BigDecimal("50"))))));

        assertEquals(400, ex.getStatus());
        assertEquals("invalidReceiveQty", ex.getCode());
        verify(stock, never()).reception(any(), any());
    }

    @Test
    void duplicatesAnOrderIntoANewDraft() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));
        when(orders.save(any(PurchaseOrder.class))).thenAnswer(call -> call.getArgument(0));

        PurchaseOrderResponse response = service.duplicate(tenant, order.getId());

        assertEquals("draft", response.status());
        assertEquals(1, response.lines().size());
        assertEquals(BigDecimal.ZERO, response.lines().get(0).receivedQty());
    }

    @Test
    void refusesToDuplicateACancelledOrder() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CANCELLED);
        when(orders.findByIdAndTenantId(order.getId(), tenant.getId()))
                .thenReturn(Optional.of(order));

        AuthException ex =
                assertThrows(
                        AuthException.class, () -> service.duplicate(tenant, order.getId()));

        assertEquals(409, ex.getStatus());
        assertEquals("cancelledOrder", ex.getCode());
    }

    @Test
    void countsTheOrdersAwaitingDeliveryAndTheLateOnes() {
        Tenant tenant = tenant();
        PurchaseOrder late = order(tenant, PurchaseStatus.CONFIRMED);
        late.setExpectedDate(LocalDate.now().minusDays(3));
        PurchaseOrder onTime = order(tenant, PurchaseStatus.CONFIRMED);
        onTime.setExpectedDate(LocalDate.now().plusDays(3));
        when(orders.findByTenantIdOrderByOrderDateDesc(tenant.getId()))
                .thenReturn(List.of(late, onTime, order(tenant, PurchaseStatus.DRAFT)));

        PurchaseSummaryResponse summary = service.summary(tenant);

        assertEquals(2, summary.awaiting());
        assertEquals(1, summary.late());
    }

    @Test
    void doesNotFindAnOrderFromAnotherTenant() {
        Tenant tenant = tenant();
        UUID id = UUID.randomUUID();
        when(orders.findByIdAndTenantId(id, tenant.getId())).thenReturn(Optional.empty());

        AuthException ex =
                assertThrows(AuthException.class, () -> service.get(tenant, id));

        assertEquals(404, ex.getStatus());
        assertEquals("notFound", ex.getCode());
    }

    @Test
    void searchesTheNumberAndTheSupplierName() {
        Tenant tenant = tenant();
        PurchaseOrder order = order(tenant, PurchaseStatus.CONFIRMED);
        order.setNumber("BC-2026-0007");
        order.setSupplierName("Nord Industries");
        when(orders.findByTenantIdOrderByOrderDateDesc(tenant.getId()))
                .thenReturn(List.of(order));

        var page = service.list(tenant, 0, 10, "nord", null, null);

        assertEquals(1, page.total());
        assertEquals(1, page.items().size());
        assertTrue(page.items().get(0).number().startsWith("BC-2026"));
    }

    private PurchaseOrderRequest request(Tenant tenant, String expectedDate) {
        return new PurchaseOrderRequest(
                supplierId().toString(),
                LocalDate.of(2026, 5, 10),
                LocalDate.parse(expectedDate),
                "net30",
                "USD",
                "",
                List.of(
                        new PurchaseOrderRequest.Line(
                                null,
                                "SKU-1002",
                                "Mouse",
                                "piece",
                                new BigDecimal("10"),
                                new BigDecimal("15.00"),
                                BigDecimal.ZERO,
                                new BigDecimal("19"))));
    }

    private PurchaseOrder order(Tenant tenant, PurchaseStatus status) {
        PurchaseOrder order = new PurchaseOrder();
        order.setId(UUID.randomUUID());
        order.setTenant(tenant);
        order.setStatus(status);
        order.setSupplierId(supplierId());
        order.setSupplierName("Nord Industries");
        order.setOrderDate(LocalDate.of(2026, 5, 10));
        order.setExpectedDate(LocalDate.of(2026, 5, 20));
        order.setCurrency("USD");
        order.setPaymentTerms(com.erp.erp.purchases.model.PaymentTerms.NET30);

        PurchaseOrderLine line = new PurchaseOrderLine();
        line.setId(UUID.randomUUID());
        line.setOrder(order);
        line.setLinePosition(1);
        line.setProductId(UUID.fromString("a1000000-0000-4000-8000-000000000002"));
        line.setDescription("Mouse");
        line.setUnit("piece");
        line.setQuantity(new BigDecimal("10"));
        line.setUnitCost(new BigDecimal("15.00"));
        line.setDiscountPct(BigDecimal.ZERO);
        line.setVatRate(new BigDecimal("19"));
        line.setReceivedQty(BigDecimal.ZERO);
        order.getLines().add(line);

        return order;
    }

    private void givenSupplier(Tenant tenant, boolean isSupplier) {
        CrmPartner partner = new CrmPartner();
        partner.setId(supplierId());
        partner.setTenant(tenant);
        partner.setName("Nord Industries");
        partner.setTaxId("78-3345678");
        partner.setAddressStreet("Wiener Strasse 12");
        partner.setAddressCity("Berlin");
        partner.setAddressCountry("DE");
        partner.setSupplier(isSupplier);
        when(partners.findByIdAndTenantId(supplierId(), tenant.getId()))
                .thenReturn(Optional.of(partner));
    }

    private UUID supplierId() {
        return UUID.fromString("f4a1c2e0-8a01-4a10-9d21-000000000003");
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

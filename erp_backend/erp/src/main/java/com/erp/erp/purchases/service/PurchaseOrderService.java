package com.erp.erp.purchases.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.common.dto.PageResponse;
import com.erp.erp.crm.model.CrmPartner;
import com.erp.erp.crm.repository.CrmPartnerRepository;
import com.erp.erp.purchases.dto.PurchaseOrderRequest;
import com.erp.erp.purchases.dto.PurchaseOrderResponse;
import com.erp.erp.purchases.dto.PurchaseReceptionRequest;
import com.erp.erp.purchases.dto.PurchaseSummaryResponse;
import com.erp.erp.purchases.model.PaymentTerms;
import com.erp.erp.purchases.model.PurchaseOrder;
import com.erp.erp.purchases.model.PurchaseOrderLine;
import com.erp.erp.purchases.model.PurchaseReception;
import com.erp.erp.purchases.model.PurchaseReceptionLine;
import com.erp.erp.purchases.model.PurchaseStatus;
import com.erp.erp.purchases.repository.PurchaseOrderRepository;
import com.erp.erp.stock.dto.ReceptionRequest;
import com.erp.erp.stock.dto.StockItemRequest;
import com.erp.erp.stock.service.StockService;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The purchase orders of a workspace: drafts, confirmations and receptions. */
@Service
public class PurchaseOrderService {

    private static final int DEFAULT_SIZE = 10;
    private static final int MAX_SIZE = 500;
    private static final String NUMBER_PREFIX = "BC";

    private final PurchaseOrderRepository orders;
    private final CrmPartnerRepository partners;
    private final StockService stock;

    public PurchaseOrderService(
            PurchaseOrderRepository orders, CrmPartnerRepository partners, StockService stock) {
        this.orders = orders;
        this.partners = partners;
        this.stock = stock;
    }

    @Transactional(readOnly = true)
    public PageResponse<PurchaseOrderResponse> list(
            Tenant tenant, int page, int size, String search, String status, String sort) {
        List<PurchaseOrder> all = orders.findByTenantIdOrderByOrderDateDesc(tenant.getId());
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        PurchaseStatus statusFilter = status == null || status.isBlank() ? null : parseStatus(status);

        List<PurchaseOrder> filtered =
                all.stream()
                        .filter(order -> statusFilter == null || order.getStatus() == statusFilter)
                        .filter(order -> query.isEmpty() || matches(order, query))
                        .sorted(comparator(sort))
                        .toList();

        int pageSize = size <= 0 ? DEFAULT_SIZE : Math.min(size, MAX_SIZE);
        int currentPage = Math.max(0, page);
        int from = Math.min(currentPage * pageSize, filtered.size());
        int to = Math.min(from + pageSize, filtered.size());

        List<PurchaseOrderResponse> items =
                filtered.subList(from, to).stream().map(PurchaseOrderResponse::from).toList();

        return new PageResponse<>(items, filtered.size(), currentPage, pageSize);
    }

    @Transactional(readOnly = true)
    public PurchaseOrderResponse get(Tenant tenant, UUID id) {
        return PurchaseOrderResponse.from(find(tenant, id));
    }

    @Transactional(readOnly = true)
    public PurchaseSummaryResponse summary(Tenant tenant) {
        long awaiting = 0;
        long late = 0;
        LocalDate today = LocalDate.now();

        for (PurchaseOrder order : orders.findByTenantIdOrderByOrderDateDesc(tenant.getId())) {
            if (order.getStatus() != PurchaseStatus.CONFIRMED || fullyReceived(order)) {
                continue;
            }
            awaiting++;
            if (order.getExpectedDate().isBefore(today)) {
                late++;
            }
        }

        return new PurchaseSummaryResponse(awaiting, late);
    }

    @Transactional
    public PurchaseOrderResponse create(Tenant tenant, PurchaseOrderRequest request) {
        PurchaseOrder order = new PurchaseOrder();
        order.setTenant(tenant);
        apply(order, request);
        return PurchaseOrderResponse.from(orders.save(order));
    }

    @Transactional
    public PurchaseOrderResponse update(Tenant tenant, UUID id, PurchaseOrderRequest request) {
        PurchaseOrder order = find(tenant, id);
        if (order.getStatus() != PurchaseStatus.DRAFT) {
            throw new AuthException(409, "only a draft purchase order can be edited", "notDraft");
        }
        apply(order, request);
        order.setUpdatedAt(Instant.now());
        return PurchaseOrderResponse.from(orders.save(order));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        PurchaseOrder order = find(tenant, id);
        if (order.getStatus() != PurchaseStatus.DRAFT) {
            throw new AuthException(409, "only a draft purchase order can be deleted", "notDraft");
        }
        orders.delete(order);
    }

    @Transactional
    public PurchaseOrderResponse confirm(Tenant tenant, UUID id) {
        PurchaseOrder order = find(tenant, id);
        if (order.getStatus() != PurchaseStatus.DRAFT) {
            throw new AuthException(409, "only a draft purchase order can be confirmed", "notDraft");
        }
        if (order.getLines().isEmpty()) {
            throw new AuthException(400, "the purchase order has no line", "noLines");
        }

        CrmPartner supplier = supplier(tenant, order.getSupplierId().toString());
        order.setNumber(nextNumber(tenant, order.getOrderDate()));
        order.setSupplierName(supplier.getName());
        order.setSupplierTaxId(supplier.getTaxId());
        order.setSupplierAddress(address(supplier));
        order.setStatus(PurchaseStatus.CONFIRMED);
        order.setConfirmedAt(Instant.now());
        order.setUpdatedAt(Instant.now());

        return PurchaseOrderResponse.from(orders.save(order));
    }

    @Transactional
    public PurchaseOrderResponse cancel(Tenant tenant, UUID id) {
        PurchaseOrder order = find(tenant, id);
        if (order.getStatus() != PurchaseStatus.CONFIRMED) {
            throw new AuthException(409, "only a confirmed purchase order can be cancelled", "notConfirmed");
        }
        if (!order.getReceptions().isEmpty()) {
            throw new AuthException(409, "the purchase order already has receptions", "hasReceptions");
        }

        order.setStatus(PurchaseStatus.CANCELLED);
        order.setCancelledAt(Instant.now());
        order.setUpdatedAt(Instant.now());

        return PurchaseOrderResponse.from(orders.save(order));
    }

    @Transactional
    public PurchaseOrderResponse duplicate(Tenant tenant, UUID id) {
        PurchaseOrder source = find(tenant, id);
        if (source.getStatus() == PurchaseStatus.CANCELLED) {
            throw new AuthException(409, "a cancelled purchase order cannot be duplicated", "cancelledOrder");
        }

        LocalDate today = LocalDate.now();
        PurchaseOrder copy = new PurchaseOrder();
        copy.setTenant(tenant);
        copy.setSupplierId(source.getSupplierId());
        copy.setSupplierName(source.getSupplierName());
        copy.setSupplierTaxId(source.getSupplierTaxId());
        copy.setSupplierAddress(source.getSupplierAddress());
        copy.setOrderDate(today);
        copy.setExpectedDate(today.plusDays(14));
        copy.setPaymentTerms(source.getPaymentTerms());
        copy.setCurrency(source.getCurrency());
        copy.setNotes(source.getNotes());

        int position = 1;
        for (PurchaseOrderLine line : source.getLines()) {
            copy.getLines().add(copyLine(copy, line, position++));
        }

        return PurchaseOrderResponse.from(orders.save(copy));
    }

    @Transactional
    public PurchaseOrderResponse receive(
            Tenant tenant, UUID id, PurchaseReceptionRequest request) {
        PurchaseOrder order = find(tenant, id);
        if (order.getStatus() != PurchaseStatus.CONFIRMED) {
            throw new AuthException(409, "only a confirmed purchase order can be received", "notConfirmed");
        }
        if (fullyReceived(order)) {
            throw new AuthException(409, "the purchase order is already fully received", "alreadyComplete");
        }
        if (request.items() == null || request.items().isEmpty()) {
            throw new AuthException(400, "the reception has no line", "invalidReceiveQty");
        }

        Map<UUID, PurchaseOrderLine> byId =
                order.getLines().stream()
                        .collect(Collectors.toMap(PurchaseOrderLine::getId, line -> line));

        PurchaseReception reception = new PurchaseReception();
        reception.setOrder(order);
        reception.setDate(request.date());
        reception.setBlNumber(request.blNumber() == null ? "" : request.blNumber().trim());

        List<StockItemRequest> stockItems = new ArrayList<>();

        for (PurchaseReceptionRequest.Item item : request.items()) {
            PurchaseOrderLine line = byId.get(uuid(item.lineId()));
            if (line == null) {
                throw new AuthException(404, "purchase order line not found", "invalidReceiveQty");
            }
            BigDecimal quantity = item.quantity();
            if (quantity == null
                    || quantity.compareTo(BigDecimal.ZERO) <= 0
                    || quantity.compareTo(remaining(line)) > 0) {
                throw new AuthException(400, "the received quantity is not valid", "invalidReceiveQty");
            }

            line.setReceivedQty(line.getReceivedQty().add(quantity));

            PurchaseReceptionLine received = new PurchaseReceptionLine();
            received.setReception(reception);
            received.setOrderLine(line);
            received.setQuantity(quantity);
            reception.getLines().add(received);

            if (line.getProductId() != null) {
                stockItems.add(new StockItemRequest(line.getProductId().toString(), quantity));
            }
        }

        order.getReceptions().add(reception);
        order.setUpdatedAt(Instant.now());
        orders.save(order);

        stock.reception(
                tenant,
                new ReceptionRequest(
                        order.getId().toString(),
                        request.date(),
                        request.warehouseId(),
                        reception.getBlNumber(),
                        stockItems));

        return PurchaseOrderResponse.from(order);
    }

    private void apply(PurchaseOrder order, PurchaseOrderRequest request) {
        if (request.expectedDate().isBefore(request.orderDate())) {
            throw new AuthException(
                    400, "the expected date is before the order date", "expectedDateBeforeOrder");
        }
        if (request.lines() == null || request.lines().isEmpty()) {
            throw new AuthException(400, "the purchase order has no line", "noLines");
        }

        CrmPartner supplier = supplier(order.getTenant(), request.supplierId());
        order.setSupplierId(supplier.getId());
        order.setSupplierName(supplier.getName());
        order.setSupplierTaxId(supplier.getTaxId());
        order.setSupplierAddress(address(supplier));
        order.setOrderDate(request.orderDate());
        order.setExpectedDate(request.expectedDate());
        order.setPaymentTerms(parseTerms(request.paymentTerms()));
        order.setCurrency(request.currency().trim().toUpperCase(Locale.ROOT));
        order.setNotes(request.notes() == null ? "" : request.notes().trim());

        order.getLines().clear();
        int position = 1;
        for (PurchaseOrderRequest.Line line : request.lines()) {
            order.getLines().add(line(order, line, position++));
        }
    }

    private PurchaseOrderLine line(
            PurchaseOrder order, PurchaseOrderRequest.Line source, int position) {
        PurchaseOrderLine line = new PurchaseOrderLine();
        line.setOrder(order);
        line.setLinePosition(position);
        line.setProductId(source.productId() == null || source.productId().isBlank() ? null : uuid(source.productId()));
        line.setReference(source.reference() == null ? "" : source.reference().trim());
        line.setDescription(source.description().trim());
        line.setUnit(source.unit() == null || source.unit().isBlank() ? "piece" : source.unit().trim());
        line.setQuantity(source.quantity());
        line.setUnitCost(source.unitCost());
        line.setDiscountPct(source.discountPct() == null ? BigDecimal.ZERO : source.discountPct());
        line.setVatRate(source.vatRate());
        line.setReceivedQty(BigDecimal.ZERO);
        return line;
    }

    private PurchaseOrderLine copyLine(
            PurchaseOrder order, PurchaseOrderLine source, int position) {
        PurchaseOrderLine line = new PurchaseOrderLine();
        line.setOrder(order);
        line.setLinePosition(position);
        line.setProductId(source.getProductId());
        line.setReference(source.getReference());
        line.setDescription(source.getDescription());
        line.setUnit(source.getUnit());
        line.setQuantity(source.getQuantity());
        line.setUnitCost(source.getUnitCost());
        line.setDiscountPct(source.getDiscountPct());
        line.setVatRate(source.getVatRate());
        line.setReceivedQty(BigDecimal.ZERO);
        return line;
    }

    private CrmPartner supplier(Tenant tenant, String supplierId) {
        UUID id = uuid(supplierId);
        CrmPartner partner =
                partners
                        .findByIdAndTenantId(id, tenant.getId())
                        .orElseThrow(
                                () -> new AuthException(404, "supplier not found", "missingSupplier"));
        if (!partner.isSupplier()) {
            throw new AuthException(400, "the contact is not a supplier", "missingSupplier");
        }
        return partner;
    }

    private PurchaseOrder find(Tenant tenant, UUID id) {
        return orders
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(
                        () -> new AuthException(404, "purchase order not found", "notFound"));
    }

    /**
     * shortcut: the sequence is read from the numbers already given, so two
     * confirmations at the same moment can share a number; use a database
     * sequence when it happens.
     */
    private String nextNumber(Tenant tenant, LocalDate orderDate) {
        String year = String.valueOf(orderDate.getYear());
        int sequence = 0;

        for (PurchaseOrder order :
                orders.findByTenantIdAndNumberStartingWith(
                        tenant.getId(), NUMBER_PREFIX + "-" + year + "-")) {
            String[] parts = order.getNumber().split("-");
            if (parts.length < 3) {
                continue;
            }
            try {
                sequence = Math.max(sequence, Integer.parseInt(parts[2]));
            } catch (NumberFormatException ignored) {
                // a number that is not ours is ignored
            }
        }

        return NUMBER_PREFIX + "-" + year + "-" + String.format("%04d", sequence + 1);
    }

    private boolean fullyReceived(PurchaseOrder order) {
        return !order.getLines().isEmpty()
                && order.getLines().stream()
                        .allMatch(line -> line.getReceivedQty().compareTo(line.getQuantity()) >= 0);
    }

    private BigDecimal remaining(PurchaseOrderLine line) {
        BigDecimal remaining = line.getQuantity().subtract(line.getReceivedQty());
        return remaining.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : remaining;
    }

    private boolean matches(PurchaseOrder order, String query) {
        return contains(order.getNumber(), query) || contains(order.getSupplierName(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private Comparator<PurchaseOrder> comparator(String sort) {
        String[] parts =
                (sort == null || sort.isBlank() ? "orderDate,desc" : sort).split(",");
        String field = parts[0].trim();
        boolean descending = parts.length > 1 && parts[1].trim().equalsIgnoreCase("desc");

        Comparator<PurchaseOrder> comparator =
                "expectedDate".equals(field)
                        ? Comparator.comparing(PurchaseOrder::getExpectedDate)
                        : Comparator.comparing(PurchaseOrder::getOrderDate);

        return descending ? comparator.reversed() : comparator;
    }

    private PurchaseStatus parseStatus(String value) {
        try {
            return PurchaseStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid purchase status", "invalidStatus");
        }
    }

    private PaymentTerms parseTerms(String value) {
        try {
            return PaymentTerms.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid payment terms", "invalidPaymentTerms");
        }
    }

    private UUID uuid(String value) {
        try {
            return UUID.fromString(value == null ? "" : value.trim());
        } catch (IllegalArgumentException ex) {
            throw new AuthException(404, "not found", "notFound");
        }
    }

    private String address(CrmPartner partner) {
        return String.join(
                ", ",
                List.of(
                        partner.getAddressStreet() == null ? "" : partner.getAddressStreet().trim(),
                        partner.getAddressCity() == null ? "" : partner.getAddressCity().trim(),
                        partner.getAddressCountry() == null ? "" : partner.getAddressCountry().trim()));
    }
}

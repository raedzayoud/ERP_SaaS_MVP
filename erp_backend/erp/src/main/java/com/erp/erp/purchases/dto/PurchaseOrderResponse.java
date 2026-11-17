package com.erp.erp.purchases.dto;

import com.erp.erp.purchases.model.PurchaseOrder;
import com.erp.erp.purchases.model.PurchaseOrderLine;
import com.erp.erp.purchases.model.PurchaseReception;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** A purchase order as the frontend reads it. */
public record PurchaseOrderResponse(
        UUID id,
        String number,
        String status,
        String supplierId,
        SupplierSnapshot supplierSnapshot,
        String orderDate,
        String expectedDate,
        String paymentTerms,
        String currency,
        String notes,
        List<Line> lines,
        List<Reception> receptions,
        String createdAt,
        String updatedAt,
        String confirmedAt,
        String cancelledAt) {

    /** The supplier details frozen when the order was confirmed. */
    public record SupplierSnapshot(String name, String taxId, String address) {}

    public record Line(
            UUID id,
            String productId,
            String reference,
            String description,
            String unit,
            BigDecimal quantity,
            BigDecimal unitCost,
            BigDecimal discountPct,
            BigDecimal vatRate,
            BigDecimal receivedQty) {}

    public record Reception(
            UUID id, String date, String blNumber, List<ReceptionLine> lines, String createdAt) {}

    public record ReceptionLine(String lineId, BigDecimal quantity) {}

    public static PurchaseOrderResponse from(PurchaseOrder order) {
        return new PurchaseOrderResponse(
                order.getId(),
                order.getNumber(),
                order.getStatus() == null
                        ? null
                        : order.getStatus().name().toLowerCase(Locale.ROOT),
                order.getSupplierId() == null ? null : order.getSupplierId().toString(),
                order.getSupplierName() == null
                        ? null
                        : new SupplierSnapshot(
                                order.getSupplierName(),
                                order.getSupplierTaxId(),
                                order.getSupplierAddress()),
                order.getOrderDate() == null ? null : order.getOrderDate().toString(),
                order.getExpectedDate() == null ? null : order.getExpectedDate().toString(),
                order.getPaymentTerms() == null
                        ? null
                        : order.getPaymentTerms().name().toLowerCase(Locale.ROOT),
                order.getCurrency(),
                order.getNotes(),
                order.getLines().stream().map(PurchaseOrderResponse::line).toList(),
                order.getReceptions().stream().map(PurchaseOrderResponse::reception).toList(),
                instant(order.getCreatedAt()),
                instant(order.getUpdatedAt()),
                instant(order.getConfirmedAt()),
                instant(order.getCancelledAt()));
    }

    private static Line line(PurchaseOrderLine line) {
        return new Line(
                line.getId(),
                line.getProductId() == null ? null : line.getProductId().toString(),
                line.getReference(),
                line.getDescription(),
                line.getUnit(),
                line.getQuantity(),
                line.getUnitCost(),
                line.getDiscountPct(),
                line.getVatRate(),
                line.getReceivedQty());
    }

    private static Reception reception(PurchaseReception reception) {
        return new Reception(
                reception.getId(),
                reception.getDate() == null ? null : reception.getDate().toString(),
                reception.getBlNumber(),
                reception.getLines().stream()
                        .map(
                                item ->
                                        new ReceptionLine(
                                                item.getOrderLine().getId().toString(), item.getQuantity()))
                        .toList(),
                instant(reception.getCreatedAt()));
    }

    private static String instant(Instant value) {
        return value == null ? null : value.toString();
    }
}

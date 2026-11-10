package com.erp.erp.admin.service;

import com.erp.erp.admin.dto.AdminPaymentResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Invoice;
import com.stripe.model.StripeCollection;
import com.stripe.param.InvoiceListParams;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Read-only view of the Stripe invoices that belong to platform tenants. */
@Service
public class AdminPaymentService {

    private final StripeClient stripeClient;
    private final TenantRepository tenantRepository;
    private final String secretKey;

    public AdminPaymentService(
            StripeClient stripeClient,
            TenantRepository tenantRepository,
            @Value("${app.stripe.secret-key:}") String secretKey) {
        this.stripeClient = stripeClient;
        this.tenantRepository = tenantRepository;
        this.secretKey = secretKey;
    }

    public List<AdminPaymentResponse> list() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new AuthException(503, "billing is not configured");
        }

        try {
            StripeCollection<Invoice> invoices = stripeClient.v1()
                    .invoices()
                    .list(InvoiceListParams.builder().setLimit(100L).build());

            return invoices.getData().stream()
                    .map(this::toPayment)
                    .filter(payment -> payment != null)
                    .sorted(Comparator.comparingLong(PaymentWithCreated::created).reversed())
                    .map(PaymentWithCreated::payment)
                    .toList();
        } catch (StripeException ex) {
            throw new AuthException(502, "payment provider error");
        }
    }

    private PaymentWithCreated toPayment(Invoice invoice) {
        if (invoice.getCustomer() == null || invoice.getCustomer().isBlank()) {
            return null;
        }

        Tenant tenant = tenantRepository
                .findByStripeCustomerId(invoice.getCustomer())
                .orElse(null);
        if (tenant == null) {
            return null;
        }

        long created = invoice.getCreated() == null ? 0L : invoice.getCreated();
        long periodStart = invoice.getPeriodStart() == null ? created : invoice.getPeriodStart();
        long cents = invoice.getAmountPaid() != null && invoice.getAmountPaid() > 0
                ? invoice.getAmountPaid()
                : invoice.getAmountDue() == null ? 0L : invoice.getAmountDue();

        AdminPaymentResponse payment = new AdminPaymentResponse(
                invoice.getId(),
                tenant.getId(),
                periodOf(periodStart),
                cents / 100.0,
                paymentStatus(invoice),
                dueDateOf(invoice),
                invoice.getHostedInvoiceUrl());

        return new PaymentWithCreated(payment, created);
    }

    private String paymentStatus(Invoice invoice) {
        String status = invoice.getStatus() == null ? "" : invoice.getStatus();
        if ("paid".equals(status)) {
            return "paid";
        }
        if ("open".equals(status) && isPastDue(invoice)) {
            return "overdue";
        }
        if ("open".equals(status) || "draft".equals(status)) {
            return "pending";
        }
        return "overdue";
    }

    private boolean isPastDue(Invoice invoice) {
        if (invoice.getDueDate() == null) {
            return false;
        }
        return Instant.ofEpochSecond(invoice.getDueDate())
                .atZone(ZoneOffset.UTC)
                .toLocalDate()
                .isBefore(LocalDate.now(ZoneOffset.UTC));
    }

    private String periodOf(long epochSeconds) {
        return YearMonth.from(
                        Instant.ofEpochSecond(epochSeconds)
                                .atZone(ZoneOffset.UTC)
                                .toLocalDate())
                .toString();
    }

    private String dueDateOf(Invoice invoice) {
        if (invoice.getDueDate() == null) {
            return null;
        }
        return Instant.ofEpochSecond(invoice.getDueDate())
                .atZone(ZoneOffset.UTC)
                .toLocalDate()
                .toString();
    }

    private record PaymentWithCreated(AdminPaymentResponse payment, long created) {}
}

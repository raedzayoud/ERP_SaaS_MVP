package com.erp.erp.billing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingStatusResponse;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Customer;
import com.stripe.model.StripeCollection;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.RequestOptions;
import com.stripe.param.CustomerCreateParams;
import com.stripe.param.SubscriptionListParams;
import com.stripe.param.checkout.SessionCreateParams;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Creates Stripe Checkout / Billing Portal sessions for a tenant. */
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final StripeClient stripeClient;
    private final TenantRepository tenantRepository;
    private final StripePriceCatalog priceCatalog;
    private final String secretKey;
    private final String successUrl;
    private final String cancelUrl;
    private final String portalReturnUrl;

    public BillingService(
            StripeClient stripeClient,
            TenantRepository tenantRepository,
            StripePriceCatalog priceCatalog,
            @Value("${app.stripe.secret-key:}") String secretKey,
            @Value("${app.stripe.success-url}") String successUrl,
            @Value("${app.stripe.cancel-url}") String cancelUrl,
            @Value("${app.stripe.portal-return-url}") String portalReturnUrl) {
        this.stripeClient = stripeClient;
        this.tenantRepository = tenantRepository;
        this.priceCatalog = priceCatalog;
        this.secretKey = secretKey;
        this.successUrl = successUrl;
        this.cancelUrl = cancelUrl;
        this.portalReturnUrl = portalReturnUrl;
    }

    @Transactional
    public BillingUrlResponse checkout(UUID tenantId, String intervalValue) {
        requireConfigured();
        Tenant tenant = requireTenant(tenantId);
        BillingInterval interval = parseInterval(intervalValue);
        BillingStatus status = status(tenant);

        if (status == BillingStatus.EXEMPT) {
            throw new AuthException(409, "billing is not required for this account");
        }
        if (status == BillingStatus.ACTIVE || status == BillingStatus.PAST_DUE) {
            throw new AuthException(409, "subscription already exists; use the billing portal");
        }

        String priceId = priceCatalog.priceFor(tenant.getPlanId(), interval);
        String customerId = ensureCustomer(tenant);

        SessionCreateParams params = SessionCreateParams.builder()
                .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
                .setCustomer(customerId)
                .setClientReferenceId(tenant.getId().toString())
                .putMetadata("tenantId", tenant.getId().toString())
                .setSuccessUrl(successUrlWithSessionId())
                .setCancelUrl(cancelUrl)
                .addLineItem(SessionCreateParams.LineItem.builder()
                        .setPrice(priceId)
                        .setQuantity(1L)
                        .build())
                .setSubscriptionData(SessionCreateParams.SubscriptionData.builder()
                        .putMetadata("tenantId", tenant.getId().toString())
                        .build())
                .build();

        try {
            Session session = stripeClient.v1().checkout().sessions().create(params);
            tenant.setBillingStatus(BillingStatus.PENDING);
            tenant.setBillingInterval(interval);
            return new BillingUrlResponse(session.getUrl());
        } catch (StripeException ex) {
            throw providerError(ex);
        }
    }

    @Transactional(readOnly = true)
    public BillingStatusResponse subscription(UUID tenantId) {
        return response(requireTenant(tenantId));
    }

    /**
     * Re-reads the Stripe subscriptions for this tenant. This is the fallback
     * when a webhook is delayed or missing: a paid checkout becomes ACTIVE
     * without waiting for the next event.
     */
    @Transactional
    public BillingStatusResponse refresh(UUID tenantId) {
        requireConfigured();
        Tenant tenant = requireTenant(tenantId);
        BillingStatus current = status(tenant);

        if (current == BillingStatus.EXEMPT) {
            return response(tenant);
        }

        String customerId = tenant.getStripeCustomerId();
        if (customerId == null || customerId.isBlank()) {
            if (current == BillingStatus.PENDING) {
                tenant.setBillingStatus(BillingStatus.NONE);
            }
            return response(tenant);
        }

        try {
            StripeCollection<Subscription> subscriptions = stripeClient.v1()
                    .subscriptions()
                    .list(SubscriptionListParams.builder()
                            .setCustomer(customerId)
                            .setLimit(10L)
                            .build());

            Subscription latest = selectSubscription(subscriptions.getData());
            if (latest != null) {
                SubscriptionSync.apply(tenant, latest);
            } else if (current == BillingStatus.PENDING) {
                // No subscription means the checkout was not completed. Let the
                // client retry the payment instead of staying stuck on PENDING.
                tenant.setBillingStatus(BillingStatus.NONE);
            }

            return response(tenant);
        } catch (StripeException ex) {
            throw providerError(ex);
        }
    }

    @Transactional
    public BillingUrlResponse portal(UUID tenantId) {
        requireConfigured();
        Tenant tenant = requireTenant(tenantId);

        if (status(tenant) == BillingStatus.EXEMPT) {
            throw new AuthException(409, "billing is not required for this account");
        }
        if (tenant.getStripeCustomerId() == null || tenant.getStripeCustomerId().isBlank()) {
            throw new AuthException(400, "no stripe customer for this account");
        }

        com.stripe.param.billingportal.SessionCreateParams params =
                com.stripe.param.billingportal.SessionCreateParams.builder()
                        .setCustomer(tenant.getStripeCustomerId())
                        .setReturnUrl(portalReturnUrl)
                        .build();

        try {
            com.stripe.model.billingportal.Session session =
                    stripeClient.v1().billingPortal().sessions().create(params);
            return new BillingUrlResponse(session.getUrl());
        } catch (StripeException ex) {
            throw providerError(ex);
        }
    }

    /** Best effort: removes a customer created during a signup that will be rolled back. */
    public void deleteCustomerQuietly(String customerId) {
        if (customerId == null || customerId.isBlank() || secretKey == null || secretKey.isBlank()) {
            return;
        }

        try {
            stripeClient.v1().customers().delete(customerId);
        } catch (StripeException ex) {
            log.warn("Could not delete Stripe customer {}", customerId, ex);
        }
    }

    private String ensureCustomer(Tenant tenant) {
        if (tenant.getStripeCustomerId() != null && !tenant.getStripeCustomerId().isBlank()) {
            return tenant.getStripeCustomerId();
        }

        CustomerCreateParams params = CustomerCreateParams.builder()
                .setEmail(tenant.getEmail())
                .setName(tenant.getCompanyName())
                .putMetadata("tenantId", tenant.getId().toString())
                .build();
        RequestOptions options = RequestOptions.builder()
                .setIdempotencyKey("tenant-customer-" + tenant.getId())
                .build();

        try {
            Customer customer = stripeClient.v1().customers().create(params, options);
            tenant.setStripeCustomerId(customer.getId());
            return customer.getId();
        } catch (StripeException ex) {
            throw providerError(ex);
        }
    }

    private BillingInterval parseInterval(String value) {
        if (value == null || value.isBlank()) {
            throw new AuthException(400, "billing interval is required");
        }
        try {
            return BillingInterval.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "billing interval must be MONTHLY or ANNUAL");
        }
    }

    private Tenant requireTenant(UUID tenantId) {
        return tenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new AuthException(404, "tenant not found"));
    }

    private void requireConfigured() {
        if (secretKey == null || secretKey.isBlank()) {
            throw new AuthException(503, "billing is not configured");
        }
    }

    private BillingStatus status(Tenant tenant) {
        return tenant.getBillingStatus() == null ? BillingStatus.NONE : tenant.getBillingStatus();
    }

    private BillingStatusResponse response(Tenant tenant) {
        return new BillingStatusResponse(
                tenant.getPlanId(),
                tenant.getBillingStatus() == null ? null : tenant.getBillingStatus().name(),
                tenant.getBillingInterval() == null ? null : tenant.getBillingInterval().name(),
                tenant.getCurrentPeriodEnd() == null ? null : tenant.getCurrentPeriodEnd().toString(),
                tenant.isCancelAtPeriodEnd());
    }

    /**
     * Picks the subscription that best represents the current billing state.
     * Active subscriptions win over failed or canceled ones.
     */
    static Subscription selectSubscription(List<Subscription> subscriptions) {
        if (subscriptions == null || subscriptions.isEmpty()) {
            return null;
        }
        return subscriptions.stream()
                .max(Comparator.comparingInt(BillingService::subscriptionPriority)
                        .thenComparingLong(
                                subscription -> subscription.getCreated() == null
                                        ? 0L
                                        : subscription.getCreated()))
                .orElse(null);
    }

    private static int subscriptionPriority(Subscription subscription) {
        String status = subscription.getStatus() == null
                ? ""
                : subscription.getStatus().toLowerCase(Locale.ROOT);
        return switch (status) {
            case "active", "trialing" -> 3;
            case "past_due", "unpaid" -> 2;
            case "incomplete" -> 1;
            default -> 0;
        };
    }

    private String successUrlWithSessionId() {
        String separator = successUrl.contains("?") ? "&" : "?";
        return successUrl + separator + "session_id={CHECKOUT_SESSION_ID}";
    }

    private AuthException providerError(StripeException ex) {
        log.error("Stripe request failed", ex);
        return new AuthException(502, "payment provider error");
    }
}

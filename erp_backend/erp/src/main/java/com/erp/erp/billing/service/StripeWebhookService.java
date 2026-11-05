package com.erp.erp.billing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.billing.model.StripeEvent;
import com.erp.erp.billing.repository.StripeEventRepository;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.exception.SignatureVerificationException;
import com.stripe.exception.StripeException;
import com.stripe.model.Event;
import com.stripe.model.Invoice;
import com.stripe.model.StripeObject;
import com.stripe.model.Subscription;
import com.stripe.model.checkout.Session;
import com.stripe.net.Webhook;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Verifies and applies Stripe webhook events to the tenant. */
@Service
public class StripeWebhookService {

    private final StripeClient stripeClient;
    private final String webhookSecret;
    private final TenantRepository tenantRepository;
    private final StripeEventRepository eventRepository;

    public StripeWebhookService(
            StripeClient stripeClient,
            @Value("${app.stripe.webhook-secret:}") String webhookSecret,
            TenantRepository tenantRepository,
            StripeEventRepository eventRepository) {
        this.stripeClient = stripeClient;
        this.webhookSecret = webhookSecret;
        this.tenantRepository = tenantRepository;
        this.eventRepository = eventRepository;
    }

    @Transactional
    public void handle(String payload, String signature) {
        if (webhookSecret == null || webhookSecret.isBlank()) {
            throw new AuthException(503, "billing is not configured");
        }

        Event event;
        try {
            event = Webhook.constructEvent(payload, signature, webhookSecret);
        } catch (SignatureVerificationException ex) {
            throw new AuthException(400, "invalid stripe signature");
        }

        if (eventRepository.existsById(event.getId())) {
            return;
        }

        process(event);
        eventRepository.save(new StripeEvent(event.getId(), event.getType()));
    }

    private void process(Event event) {
        switch (event.getType()) {
            case "checkout.session.completed" -> {
                Session session = object(event, Session.class);
                handleCheckout(session, "paid".equalsIgnoreCase(session.getPaymentStatus()));
            }
            case "checkout.session.async_payment_succeeded" ->
                    handleCheckout(object(event, Session.class), true);
            case "checkout.session.async_payment_failed" ->
                    handleCheckoutFailure(object(event, Session.class));
            case "customer.subscription.created", "customer.subscription.updated" ->
                    syncSubscription(object(event, Subscription.class));
            case "customer.subscription.deleted" ->
                    syncDeletedSubscription(object(event, Subscription.class));
            case "invoice.payment_failed" ->
                    handlePaymentFailed(object(event, Invoice.class));
            default -> {
                // Other event types are acknowledged but ignored.
            }
        }
    }

    private void handleCheckout(Session session, boolean paid) {
        Tenant tenant = tenantFor(session);
        if (tenant == null) {
            return;
        }

        if (!paid) {
            if (!status(tenant).allowsPlatformAccess()) {
                tenant.setBillingStatus(BillingStatus.PENDING);
            }
            return;
        }

        String subscriptionId = session.getSubscription();
        if (subscriptionId == null || subscriptionId.isBlank()) {
            return;
        }
        SubscriptionSync.apply(tenant, retrieveSubscription(subscriptionId));
    }

    private void handleCheckoutFailure(Session session) {
        Tenant tenant = tenantFor(session);
        if (tenant != null && !status(tenant).allowsPlatformAccess()) {
            tenant.setBillingStatus(BillingStatus.NONE);
        }
    }

    private void syncSubscription(Subscription subscription) {
        Tenant tenant = tenantFor(subscription);
        if (tenant != null) {
            SubscriptionSync.apply(tenant, subscription);
        }
    }

    private void syncDeletedSubscription(Subscription subscription) {
        Tenant tenant = tenantFor(subscription);
        if (tenant != null) {
            SubscriptionSync.apply(tenant, subscription);
            tenant.setBillingStatus(BillingStatus.CANCELED);
        }
    }

    private void handlePaymentFailed(Invoice invoice) {
        if (invoice.getCustomer() == null) {
            return;
        }
        Optional<Tenant> tenant = tenantRepository.findByStripeCustomerId(invoice.getCustomer());
        if (tenant.isEmpty()) {
            return;
        }

        BillingStatus status = status(tenant.get());
        if (status == BillingStatus.ACTIVE || status == BillingStatus.PAST_DUE) {
            tenant.get().setBillingStatus(BillingStatus.PAST_DUE);
        }
    }

    private Tenant tenantFor(Session session) {
        String tenantId = tenantIdFrom(session.getMetadata());
        if (tenantId == null) {
            tenantId = session.getClientReferenceId();
        }
        return tenantById(tenantId);
    }

    private Tenant tenantFor(Subscription subscription) {
        Tenant tenant = tenantById(tenantIdFrom(subscription.getMetadata()));
        if (tenant != null) {
            return tenant;
        }
        if (subscription.getCustomer() != null) {
            Optional<Tenant> byCustomer =
                    tenantRepository.findByStripeCustomerId(subscription.getCustomer());
            if (byCustomer.isPresent()) {
                return byCustomer.get();
            }
        }
        if (subscription.getId() != null) {
            return tenantRepository
                    .findByStripeSubscriptionId(subscription.getId())
                    .orElse(null);
        }
        return null;
    }

    private Tenant tenantById(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            return null;
        }
        try {
            return tenantRepository.findById(UUID.fromString(tenantId)).orElse(null);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String tenantIdFrom(Map<String, String> metadata) {
        if (metadata == null) {
            return null;
        }
        String tenantId = metadata.get("tenantId");
        return tenantId == null || tenantId.isBlank() ? null : tenantId;
    }

    private Subscription retrieveSubscription(String subscriptionId) {
        try {
            return stripeClient.v1().subscriptions().retrieve(subscriptionId);
        } catch (StripeException ex) {
            throw new IllegalStateException("failed to retrieve stripe subscription", ex);
        }
    }

    private <T extends StripeObject> T object(Event event, Class<T> type) {
        StripeObject object = event.getDataObjectDeserializer()
                .getObject()
                .orElseThrow(() -> new IllegalStateException("stripe event object is missing"));
        if (!type.isInstance(object)) {
            throw new IllegalStateException("unexpected stripe event object");
        }
        return type.cast(object);
    }

    private BillingStatus status(Tenant tenant) {
        return tenant.getBillingStatus() == null ? BillingStatus.NONE : tenant.getBillingStatus();
    }
}

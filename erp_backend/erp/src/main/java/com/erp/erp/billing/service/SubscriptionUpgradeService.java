package com.erp.erp.billing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.tenant.model.Tenant;
import com.stripe.StripeClient;
import com.stripe.exception.StripeException;
import com.stripe.model.Invoice;
import com.stripe.model.StripeCollection;
import com.stripe.model.Subscription;
import com.stripe.param.InvoiceListParams;
import com.stripe.param.SubscriptionUpdateParams;
import java.util.ArrayList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adds a module to the subscription a workspace already pays for. The module
 * becomes a recurring line item and Stripe charges the remaining days of the
 * period right away.
 */
@Service
public class SubscriptionUpgradeService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionUpgradeService.class);

    private final StripeClient stripeClient;
    private final ModuleCatalog modules;

    public SubscriptionUpgradeService(StripeClient stripeClient, ModuleCatalog modules) {
        this.stripeClient = stripeClient;
        this.modules = modules;
    }

    /**
     * Adds the given modules to the subscription and returns the invoice the
     * customer has to pay.
     */
    @Transactional
    public BillingUrlResponse addModules(Tenant tenant, List<String> moduleIds) {
        if (moduleIds == null || moduleIds.isEmpty()) {
            throw new AuthException(400, "no module selected", "noModuleSelected");
        }
        for (String moduleId : moduleIds) {
            modules.requireSellable(moduleId);
        }
        if (tenant.getStripeSubscriptionId() == null || tenant.getStripeSubscriptionId().isBlank()) {
            throw new AuthException(400, "no subscription for this workspace", "noSubscription");
        }

        Subscription subscription = retrieve(tenant.getStripeSubscriptionId());
        List<String> existing = priceIds(subscription);
        List<String> toAdd = new ArrayList<>();
        for (String moduleId : moduleIds) {
            String priceId = modules.stripePriceFor(moduleId);
            if (priceId != null && !existing.contains(priceId)) {
                toAdd.add(priceId);
            }
        }
        if (toAdd.isEmpty()) {
            throw new AuthException(409, "these modules are already paid for", "moduleAlreadyPaid");
        }

        List<SubscriptionUpdateParams.Item> items = new ArrayList<>();
        for (String priceId : toAdd) {
            items.add(
                    SubscriptionUpdateParams.Item.builder()
                            .setPrice(priceId)
                            .setQuantity(1L)
                            .build());
        }

        SubscriptionUpdateParams params =
                SubscriptionUpdateParams.builder()
                        .addAllItem(items)
                        .setProrationBehavior(
                                SubscriptionUpdateParams.ProrationBehavior.ALWAYS_INVOICE)
                        .build();

        try {
            stripeClient.v1().subscriptions().update(tenant.getStripeSubscriptionId(), params);
            Invoice invoice = latestInvoice(tenant.getStripeSubscriptionId());
            String url = invoice == null ? null : invoice.getHostedInvoiceUrl();
            if (url == null || url.isBlank()) {
                throw new AuthException(
                        502, "the payment page could not be created", "paymentFailed");
            }
            return new BillingUrlResponse(url);
        } catch (StripeException ex) {
            log.error("Stripe module upgrade failed", ex);
            throw new AuthException(502, "payment provider error", "paymentFailed");
        }
    }

    private Subscription retrieve(String subscriptionId) {
        try {
            return stripeClient.v1().subscriptions().retrieve(subscriptionId);
        } catch (StripeException ex) {
            throw new AuthException(502, "payment provider error", "paymentFailed");
        }
    }

    private Invoice latestInvoice(String subscriptionId) {
        try {
            StripeCollection<Invoice> invoices =
                    stripeClient.v1()
                            .invoices()
                            .list(
                                    InvoiceListParams.builder()
                                            .setSubscription(subscriptionId)
                                            .setLimit(1L)
                                            .build());
            return invoices.getData().isEmpty() ? null : invoices.getData().get(0);
        } catch (StripeException ex) {
            throw new AuthException(502, "payment provider error", "paymentFailed");
        }
    }

    private List<String> priceIds(Subscription subscription) {
        List<String> priceIds = new ArrayList<>();
        if (subscription.getItems() == null || subscription.getItems().getData() == null) {
            return priceIds;
        }
        for (var item : subscription.getItems().getData()) {
            if (item.getPrice() != null) {
                priceIds.add(item.getPrice().getId());
            }
        }
        return priceIds;
    }
}

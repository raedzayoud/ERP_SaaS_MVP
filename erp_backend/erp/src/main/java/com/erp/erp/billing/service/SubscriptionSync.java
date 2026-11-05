package com.erp.erp.billing.service;

import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.Tenant;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import java.time.Instant;

/** Copies the useful Stripe subscription fields onto our Tenant. */
public final class SubscriptionSync {

    private SubscriptionSync() {}

    public static void apply(Tenant tenant, Subscription subscription) {
        tenant.setStripeCustomerId(subscription.getCustomer());
        tenant.setStripeSubscriptionId(subscription.getId());
        tenant.setBillingStatus(BillingStatus.fromStripe(subscription.getStatus()));
        tenant.setCancelAtPeriodEnd(Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd()));

        BillingInterval interval = null;
        Long periodEnd = null;

        if (subscription.getItems() != null && subscription.getItems().getData() != null) {
            for (SubscriptionItem item : subscription.getItems().getData()) {
                if (interval == null) {
                    interval = interval(item);
                }
                if (item.getCurrentPeriodEnd() != null
                        && (periodEnd == null || item.getCurrentPeriodEnd() > periodEnd)) {
                    periodEnd = item.getCurrentPeriodEnd();
                }
            }
        }

        if (periodEnd != null) {
            tenant.setCurrentPeriodEnd(Instant.ofEpochSecond(periodEnd));
        }
        if (interval != null) {
            tenant.setBillingInterval(interval);
        }
    }

    static BillingInterval interval(SubscriptionItem item) {
        if (item.getPrice() == null || item.getPrice().getRecurring() == null) {
            return null;
        }
        return BillingInterval.fromStripe(item.getPrice().getRecurring().getInterval());
    }
}

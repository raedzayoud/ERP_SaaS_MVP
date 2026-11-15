package com.erp.erp.billing.service;

import com.erp.erp.billing.model.BillingInterval;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.Tenant;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Copies the useful Stripe subscription fields onto our Tenant. */
@Service
public class SubscriptionSync {

    private final ModuleCatalog modules;
    private final StripePriceCatalog prices;

    public SubscriptionSync(ModuleCatalog modules, StripePriceCatalog prices) {
        this.modules = modules;
        this.prices = prices;
    }

    public void apply(Tenant tenant, Subscription subscription) {
        tenant.setStripeCustomerId(subscription.getCustomer());
        tenant.setStripeSubscriptionId(subscription.getId());
        tenant.setBillingStatus(BillingStatus.fromStripe(subscription.getStatus()));
        tenant.setCancelAtPeriodEnd(Boolean.TRUE.equals(subscription.getCancelAtPeriodEnd()));

        BillingInterval interval = null;
        Long periodEnd = null;

        for (SubscriptionItem item : items(subscription)) {
            if (interval == null) {
                interval = interval(item);
            }
            if (item.getCurrentPeriodEnd() != null
                    && (periodEnd == null || item.getCurrentPeriodEnd() > periodEnd)) {
                periodEnd = item.getCurrentPeriodEnd();
            }
        }

        if (periodEnd != null) {
            tenant.setCurrentPeriodEnd(Instant.ofEpochSecond(periodEnd));
        }
        if (interval != null) {
            tenant.setBillingInterval(interval);
        }

        applyPlan(tenant, subscription);
    }

    /** The plan the subscription pays for, when it pays for one of our plans. */
    private void applyPlan(Tenant tenant, Subscription subscription) {
        for (SubscriptionItem item : items(subscription)) {
            if (item.getPrice() == null) {
                continue;
            }
            prices.planFor(item.getPrice().getId()).ifPresent(tenant::setPlanId);
        }
    }

    /**
     * Unlocks the modules the subscription pays for. The modules are additive:
     * the ones the workspace already had are kept.
     */
    public void unlockPaidModules(Tenant tenant, Subscription subscription) {
        Set<String> enabled = new LinkedHashSet<>(tenant.getModuleList());
        for (SubscriptionItem item : items(subscription)) {
            if (item.getPrice() == null) {
                continue;
            }
            modules
                    .moduleFor(item.getPrice().getId())
                    .ifPresent(moduleId -> enabled.addAll(modules.withDependencies(moduleId)));
        }
        tenant.setModuleList(new ArrayList<>(enabled));
    }

    private List<SubscriptionItem> items(Subscription subscription) {
        if (subscription.getItems() == null || subscription.getItems().getData() == null) {
            return List.of();
        }
        return subscription.getItems().getData();
    }

    static BillingInterval interval(SubscriptionItem item) {
        if (item.getPrice() == null || item.getPrice().getRecurring() == null) {
            return null;
        }
        return BillingInterval.fromStripe(item.getPrice().getRecurring().getInterval());
    }
}

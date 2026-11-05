package com.erp.erp.billing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.model.BillingInterval;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Maps our plan + interval to the Stripe Price id configured in the environment. */
@Service
public class StripePriceCatalog {

    private static final Set<String> KNOWN_PLANS = Set.of("starter", "business", "enterprise");

    private final Map<String, String> prices;

    public StripePriceCatalog(
            @Value("${app.stripe.price.starter.monthly:}") String starterMonthly,
            @Value("${app.stripe.price.starter.annual:}") String starterAnnual,
            @Value("${app.stripe.price.business.monthly:}") String businessMonthly,
            @Value("${app.stripe.price.business.annual:}") String businessAnnual,
            @Value("${app.stripe.price.enterprise.monthly:}") String enterpriseMonthly,
            @Value("${app.stripe.price.enterprise.annual:}") String enterpriseAnnual) {
        this.prices = Map.of(
                "starter_MONTHLY", starterMonthly,
                "starter_ANNUAL", starterAnnual,
                "business_MONTHLY", businessMonthly,
                "business_ANNUAL", businessAnnual,
                "enterprise_MONTHLY", enterpriseMonthly,
                "enterprise_ANNUAL", enterpriseAnnual);
    }

    public String priceFor(String planId, BillingInterval interval) {
        if (planId == null || !KNOWN_PLANS.contains(planId)) {
            throw new AuthException(400, "unknown plan");
        }
        if (interval == null) {
            throw new AuthException(400, "billing interval is required");
        }

        String priceId = prices.get(planId + "_" + interval.name());
        if (priceId == null || priceId.isBlank()) {
            throw new AuthException(503, "billing is not configured for " + planId + " " + interval.name());
        }
        return priceId;
    }
}

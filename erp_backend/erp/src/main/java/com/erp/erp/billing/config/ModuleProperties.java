package com.erp.erp.billing.config;

import java.math.BigDecimal;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * The modules a workspace can buy on top of its plan.
 *
 * <p>{@code prices} holds the monthly price shown to the customer and
 * {@code stripePrices} the Stripe price id used to charge it. A module without
 * a Stripe price is not offered for sale.
 */
@ConfigurationProperties(prefix = "app.module")
public record ModuleProperties(Map<String, BigDecimal> prices, Map<String, String> stripePrices) {

    public ModuleProperties {
        prices = prices == null ? Map.of() : Map.copyOf(prices);
        stripePrices = stripePrices == null ? Map.of() : Map.copyOf(stripePrices);
    }
}

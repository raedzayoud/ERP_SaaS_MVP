package com.erp.erp.billing.model;

import java.util.Locale;

/** Billing period chosen by the customer. */
public enum BillingInterval {
    MONTHLY,
    ANNUAL;

    /** Converts a Stripe price interval ("month" / "year") to our enum. */
    public static BillingInterval fromStripe(String interval) {
        if (interval == null || interval.isBlank()) {
            return null;
        }
        return switch (interval.trim().toLowerCase(Locale.ROOT)) {
            case "month" -> MONTHLY;
            case "year" -> ANNUAL;
            default -> null;
        };
    }
}

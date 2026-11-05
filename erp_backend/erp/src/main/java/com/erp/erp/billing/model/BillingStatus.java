package com.erp.erp.billing.model;

import java.util.Locale;

/** Subscription state used by the platform access rules. */
public enum BillingStatus {
    NONE,
    PENDING,
    ACTIVE,
    PAST_DUE,
    CANCELED,
    EXEMPT;

    public boolean allowsPlatformAccess() {
        return this == ACTIVE || this == EXEMPT;
    }

    public boolean allowsKycApproval() {
        return allowsPlatformAccess();
    }

    /** Converts a Stripe subscription status to our smaller set of states. */
    public static BillingStatus fromStripe(String status) {
        if (status == null || status.isBlank()) {
            return PENDING;
        }
        return switch (status.trim().toLowerCase(Locale.ROOT)) {
            case "active", "trialing" -> ACTIVE;
            case "past_due", "unpaid" -> PAST_DUE;
            case "canceled", "incomplete_expired" -> CANCELED;
            default -> PENDING;
        };
    }
}

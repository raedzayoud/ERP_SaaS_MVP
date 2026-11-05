package com.erp.erp.billing.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class BillingStatusTest {

    @Test
    void mapsStripeSubscriptionStatuses() {
        assertEquals(BillingStatus.ACTIVE, BillingStatus.fromStripe("active"));
        assertEquals(BillingStatus.ACTIVE, BillingStatus.fromStripe("trialing"));
        assertEquals(BillingStatus.PAST_DUE, BillingStatus.fromStripe("past_due"));
        assertEquals(BillingStatus.PAST_DUE, BillingStatus.fromStripe("unpaid"));
        assertEquals(BillingStatus.CANCELED, BillingStatus.fromStripe("canceled"));
        assertEquals(BillingStatus.CANCELED, BillingStatus.fromStripe("incomplete_expired"));
        assertEquals(BillingStatus.PENDING, BillingStatus.fromStripe("incomplete"));
        assertEquals(BillingStatus.PENDING, BillingStatus.fromStripe("paused"));
        assertEquals(BillingStatus.PENDING, BillingStatus.fromStripe(null));
    }

    @Test
    void onlyActiveAndExemptAllowAccessAndApproval() {
        assertTrue(BillingStatus.ACTIVE.allowsPlatformAccess());
        assertTrue(BillingStatus.ACTIVE.allowsKycApproval());
        assertTrue(BillingStatus.EXEMPT.allowsPlatformAccess());
        assertTrue(BillingStatus.EXEMPT.allowsKycApproval());

        assertFalse(BillingStatus.NONE.allowsPlatformAccess());
        assertFalse(BillingStatus.PENDING.allowsPlatformAccess());
        assertFalse(BillingStatus.PAST_DUE.allowsPlatformAccess());
        assertFalse(BillingStatus.CANCELED.allowsPlatformAccess());
    }
}

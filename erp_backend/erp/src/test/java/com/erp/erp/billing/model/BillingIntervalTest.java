package com.erp.erp.billing.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;

class BillingIntervalTest {

    @Test
    void mapsStripePriceIntervals() {
        assertEquals(BillingInterval.MONTHLY, BillingInterval.fromStripe("month"));
        assertEquals(BillingInterval.ANNUAL, BillingInterval.fromStripe("year"));
        assertNull(BillingInterval.fromStripe("week"));
        assertNull(BillingInterval.fromStripe(null));
    }
}

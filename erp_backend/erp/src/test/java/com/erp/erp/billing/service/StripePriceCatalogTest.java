package com.erp.erp.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.model.BillingInterval;
import org.junit.jupiter.api.Test;

class StripePriceCatalogTest {

    private final StripePriceCatalog catalog = new StripePriceCatalog(
            "price_starter_monthly",
            "price_starter_annual",
            "price_business_monthly",
            "price_business_annual",
            "price_enterprise_monthly",
            "price_enterprise_annual");

    @Test
    void returnsConfiguredPrice() {
        assertEquals(
                "price_business_annual",
                catalog.priceFor("business", BillingInterval.ANNUAL));
    }

    @Test
    void missingConfigurationReturns503() {
        StripePriceCatalog empty = new StripePriceCatalog("", "", "", "", "", "");

        AuthException ex = assertThrows(
                AuthException.class,
                () -> empty.priceFor("starter", BillingInterval.MONTHLY));

        assertEquals(503, ex.getStatus());
    }

    @Test
    void unknownPlanReturns400() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> catalog.priceFor("gold", BillingInterval.MONTHLY));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void missingIntervalReturns400() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> catalog.priceFor("starter", null));

        assertEquals(400, ex.getStatus());
    }
}

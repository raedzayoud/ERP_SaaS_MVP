package com.erp.erp.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.erp.erp.billing.config.ModuleProperties;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ModuleCatalogTest {

    private final ModuleCatalog catalog =
            new ModuleCatalog(
                    new ModuleProperties(
                            Map.of("stock", new BigDecimal("20.00"), "hr", new BigDecimal("25.00")),
                            Map.of("stock", "price_stock", "hr", "price_hr")));

    @Test
    void listsEveryPricedModuleAndFlagsTheOnesWithoutAStripePrice() {
        ModuleProperties properties =
                new ModuleProperties(
                        Map.of("stock", new BigDecimal("20.00"), "hr", new BigDecimal("25.00")),
                        Map.of("stock", "price_stock"));
        ModuleCatalog partial = new ModuleCatalog(properties);

        assertEquals(List.of("hr", "stock"), partial.offers().stream().map(o -> o.id()).toList());
        assertEquals(false, partial.offers().get(0).saleable());
        assertEquals(true, partial.offers().get(1).saleable());
        assertEquals(new BigDecimal("20.00"), partial.priceOf("stock"));
    }

    @Test
    void findsTheModuleOfAStripePrice() {
        assertEquals("stock", catalog.moduleFor("price_stock").orElse(null));
        assertTrue(catalog.moduleFor("price_unknown").isEmpty());
    }

    @Test
    void addsTheDependenciesOfAModule() {
        assertEquals(List.of("stock", "products"), catalog.withDependencies("stock"));
        assertEquals(List.of("hr"), catalog.withDependencies("hr"));
        assertEquals(List.of("reports"), catalog.withDependencies("reports"));
    }
}

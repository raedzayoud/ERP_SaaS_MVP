package com.erp.erp.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.billing.config.ModuleProperties;
import com.erp.erp.tenant.model.Tenant;
import com.stripe.model.Price;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.SubscriptionItemCollection;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SubscriptionSyncTest {

    private final ModuleCatalog modules =
            new ModuleCatalog(
                    new ModuleProperties(
                            Map.of("stock", new BigDecimal("20.00")),
                            Map.of("stock", "price_stock")));

    private final StripePriceCatalog prices =
            new StripePriceCatalog("price_starter", "", "price_business", "", "", "");

    private final SubscriptionSync sync = new SubscriptionSync(modules, prices);

    @Test
    void appliesThePlanOfTheSubscription() {
        Tenant tenant = new Tenant();

        sync.apply(tenant, subscription("price_business", null));

        assertEquals("business", tenant.getPlanId());
    }

    @Test
    void unlocksThePaidModulesAndTheirDependencies() {
        Tenant tenant = new Tenant();
        tenant.setModuleList(List.of("dashboard"));

        sync.unlockPaidModules(tenant, subscription(null, "price_stock"));

        assertTrue(tenant.getModuleList().contains("stock"));
        assertTrue(tenant.getModuleList().contains("products"));
        assertTrue(tenant.getModuleList().contains("dashboard"));
    }

    @Test
    void keepsTheModulesTheWorkspaceAlreadyHad() {
        Tenant tenant = new Tenant();
        tenant.setModuleList(List.of("contacts"));

        sync.unlockPaidModules(tenant, subscription(null, null));

        assertEquals(List.of("contacts"), tenant.getModuleList());
    }

    private Subscription subscription(String planPriceId, String modulePriceId) {
        Price price = mock(Price.class);
        when(price.getId()).thenReturn(modulePriceId != null ? modulePriceId : planPriceId);

        SubscriptionItem item = mock(SubscriptionItem.class);
        when(item.getPrice()).thenReturn(price);

        SubscriptionItemCollection items = mock(SubscriptionItemCollection.class);
        when(items.getData()).thenReturn(List.of(item));

        Subscription subscription = mock(Subscription.class);
        when(subscription.getItems()).thenReturn(items);
        when(subscription.getStatus()).thenReturn("active");
        when(subscription.getId()).thenReturn("sub_1");
        return subscription;
    }
}

package com.erp.erp.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.config.ModuleProperties;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.tenant.model.Tenant;
import com.stripe.StripeClient;
import com.stripe.model.Invoice;
import com.stripe.model.Price;
import com.stripe.model.StripeCollection;
import com.stripe.model.Subscription;
import com.stripe.model.SubscriptionItem;
import com.stripe.model.SubscriptionItemCollection;
import com.stripe.param.InvoiceListParams;
import com.stripe.param.SubscriptionUpdateParams;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;

class SubscriptionUpgradeServiceTest {

    private final ModuleCatalog modules =
            new ModuleCatalog(
                    new ModuleProperties(
                            Map.of("stock", new BigDecimal("20.00")),
                            Map.of("stock", "price_stock")));

    private final StripeClient stripeClient = mock(StripeClient.class, Answers.RETURNS_DEEP_STUBS);
    private final SubscriptionUpgradeService service =
            new SubscriptionUpgradeService(stripeClient, modules);

    @Test
    void addsTheModuleToTheSubscriptionAndReturnsTheInvoice() throws Exception {
        Tenant tenant = tenant();
        Subscription subscription = subscriptionWithPrice("price_plan");
        when(stripeClient.v1().subscriptions().retrieve("sub_1")).thenReturn(subscription);

        Invoice invoice = mock(Invoice.class);
        when(invoice.getHostedInvoiceUrl()).thenReturn("https://stripe.test/invoice");
        StripeCollection<Invoice> invoices = mock(StripeCollection.class);
        when(invoices.getData()).thenReturn(List.of(invoice));
        when(stripeClient.v1().invoices().list(any(InvoiceListParams.class))).thenReturn(invoices);

        BillingUrlResponse response = service.addModules(tenant, List.of("stock"));

        assertEquals("https://stripe.test/invoice", response.url());
        verify(stripeClient.v1().subscriptions())
                .update(eq("sub_1"), any(SubscriptionUpdateParams.class));
    }

    @Test
    void refusesAModuleThatIsNotForSale() throws Exception {
        AuthException ex =
                assertThrows(
                        AuthException.class, () -> service.addModules(tenant(), List.of("accounting")));

        assertEquals(400, ex.getStatus());
        assertEquals("unknownModule", ex.getCode());
    }

    @Test
    void refusesAWorkspaceWithoutSubscription() throws Exception {
        Tenant tenant = tenant();
        tenant.setStripeSubscriptionId(null);

        AuthException ex =
                assertThrows(
                        AuthException.class, () -> service.addModules(tenant, List.of("stock")));

        assertEquals(400, ex.getStatus());
        assertEquals("noSubscription", ex.getCode());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setStripeSubscriptionId("sub_1");
        return tenant;
    }

    private Subscription subscriptionWithPrice(String priceId) {
        Price price = mock(Price.class);
        when(price.getId()).thenReturn(priceId);

        SubscriptionItem item = mock(SubscriptionItem.class);
        when(item.getPrice()).thenReturn(price);

        SubscriptionItemCollection items = mock(SubscriptionItemCollection.class);
        when(items.getData()).thenReturn(List.of(item));

        Subscription subscription = mock(Subscription.class);
        when(subscription.getItems()).thenReturn(items);
        when(subscription.getId()).thenReturn("sub_1");
        return subscription;
    }
}

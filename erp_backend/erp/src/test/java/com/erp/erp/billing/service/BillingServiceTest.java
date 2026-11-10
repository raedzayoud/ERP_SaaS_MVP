package com.erp.erp.billing.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.billing.dto.BillingStatusResponse;
import com.erp.erp.billing.model.BillingStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import com.stripe.StripeClient;
import com.stripe.model.StripeCollection;
import com.stripe.model.Subscription;
import com.stripe.param.SubscriptionListParams;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.Answers;

class BillingServiceTest {

    private static final UUID TENANT_ID = UUID.randomUUID();

    @Test
    void refreshMovesPendingWithoutCustomerToNone() {
        Tenant tenant = tenant(BillingStatus.PENDING);
        TenantRepository repository = repository(tenant);

        BillingStatusResponse response = service(repository, null).refresh(TENANT_ID);

        assertEquals("NONE", response.billingStatus());
    }

    @Test
    void refreshLeavesExemptAccountUntouched() {
        Tenant tenant = tenant(BillingStatus.EXEMPT);
        TenantRepository repository = repository(tenant);

        BillingStatusResponse response = service(repository, null).refresh(TENANT_ID);

        assertEquals("EXEMPT", response.billingStatus());
    }

    @Test
    void refreshAppliesTheActiveStripeSubscription() throws Exception {
        Tenant tenant = tenant(BillingStatus.PENDING);
        tenant.setStripeCustomerId("cus_123");
        TenantRepository repository = repository(tenant);

        StripeClient stripeClient = mock(StripeClient.class, Answers.RETURNS_DEEP_STUBS);
        when(stripeClient.v1().subscriptions().list(any(SubscriptionListParams.class)))
                .thenReturn(collection(subscription("active", 100L)));

        BillingStatusResponse response = service(repository, stripeClient).refresh(TENANT_ID);

        assertEquals("ACTIVE", response.billingStatus());
        assertEquals("cus_123", tenant.getStripeCustomerId());
        assertEquals("sub_active", tenant.getStripeSubscriptionId());
    }

    @Test
    void refreshMovesPendingToNoneWhenStripeHasNoSubscription() throws Exception {
        Tenant tenant = tenant(BillingStatus.PENDING);
        tenant.setStripeCustomerId("cus_123");
        TenantRepository repository = repository(tenant);

        StripeClient stripeClient = mock(StripeClient.class, Answers.RETURNS_DEEP_STUBS);
        when(stripeClient.v1().subscriptions().list(any(SubscriptionListParams.class)))
                .thenReturn(collection());

        BillingStatusResponse response = service(repository, stripeClient).refresh(TENANT_ID);

        assertEquals("NONE", response.billingStatus());
    }

    @Test
    void selectSubscriptionPrefersActiveOverCanceled() {
        Subscription active = subscription("active", 100L);
        Subscription canceled = subscription("canceled", 200L);

        Subscription selected = BillingService.selectSubscription(List.of(canceled, active));

        assertEquals("sub_active", selected.getId());
    }

    @Test
    void refreshDoesNotCallStripeForAnExemptAccount() {
        Tenant tenant = tenant(BillingStatus.EXEMPT);
        tenant.setStripeCustomerId("cus_123");
        TenantRepository repository = repository(tenant);
        StripeClient stripeClient = mock(StripeClient.class, Answers.RETURNS_DEEP_STUBS);

        service(repository, stripeClient).refresh(TENANT_ID);

        verify(stripeClient, never()).v1();
    }

    private BillingService service(TenantRepository repository, StripeClient stripeClient) {
        return new BillingService(
                stripeClient,
                repository,
                null,
                "sk_test",
                "http://localhost:4200/signup/success",
                "http://localhost:4200/signup/payment-cancelled",
                "http://localhost:4200/settings/billing");
    }

    private TenantRepository repository(Tenant tenant) {
        TenantRepository repository = mock(TenantRepository.class);
        when(repository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));
        return repository;
    }

    private Tenant tenant(BillingStatus status) {
        Tenant tenant = new Tenant();
        tenant.setPlanId("starter");
        tenant.setBillingStatus(status);
        return tenant;
    }

    private StripeCollection<Subscription> collection(Subscription... subscriptions) {
        StripeCollection<Subscription> collection = new StripeCollection<>();
        collection.setData(List.of(subscriptions));
        return collection;
    }

    private Subscription subscription(String status, Long created) {
        Subscription subscription = new Subscription();
        subscription.setId("sub_" + status);
        subscription.setCustomer("cus_123");
        subscription.setStatus(status);
        subscription.setCreated(created);
        return subscription;
    }
}

package com.erp.erp.settings.service;

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
import com.erp.erp.billing.service.ModuleCatalog;
import com.erp.erp.billing.service.SubscriptionUpgradeService;
import com.erp.erp.settings.dto.AddModulesRequest;
import com.erp.erp.settings.dto.ModuleCatalogResponse;
import com.erp.erp.settings.dto.ModuleOfferResponse;
import com.erp.erp.settings.dto.ModulePurchaseResponse;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SettingsModuleServiceTest {

    private final ModuleCatalog modules =
            new ModuleCatalog(
                    new ModuleProperties(
                            Map.of(
                                    "stock", new BigDecimal("20.00"),
                                    "hr", new BigDecimal("25.00")),
                            Map.of(
                                    "stock", "price_stock",
                                    "hr", "price_hr")));

    private final SubscriptionUpgradeService upgrades = mock(SubscriptionUpgradeService.class);
    private final SettingsModuleService service = new SettingsModuleService(modules, upgrades);

    @Test
    void listsTheOffersAndTheEnabledModules() {
        Tenant tenant = tenant();
        tenant.setModuleList(List.of("dashboard", "products"));

        ModuleCatalogResponse catalog = service.catalog(tenant);

        assertEquals("starter", catalog.plan());
        assertEquals(List.of("dashboard", "products"), catalog.enabledModules());
        assertEquals(2, catalog.offers().size());
        ModuleOfferResponse stock =
                catalog.offers().stream().filter(offer -> offer.id().equals("stock")).findFirst().orElseThrow();
        assertEquals(List.of("products"), stock.dependencies());
        assertEquals(true, stock.saleable());
    }

    @Test
    void chargesOnlyTheMissingModules() {
        Tenant tenant = tenant();
        tenant.setModuleList(List.of("dashboard"));
        when(upgrades.addModules(eq(tenant), any()))
                .thenReturn(new BillingUrlResponse("https://stripe.test/invoice"));

        ModulePurchaseResponse purchase =
                service.addModules(tenant, new AddModulesRequest(List.of("stock")));

        assertEquals(new BigDecimal("20.00"), purchase.totalMonthly());
        assertEquals(List.of("stock"), purchase.modules());
        assertEquals("https://stripe.test/invoice", purchase.url());
        verify(upgrades).addModules(eq(tenant), eq(List.of("stock")));
    }

    @Test
    void doesNotChargeAModuleTheWorkspaceAlreadyHas() {
        Tenant tenant = tenant();
        tenant.setModuleList(List.of("dashboard", "stock"));

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () -> service.addModules(tenant, new AddModulesRequest(List.of("stock"))));

        assertEquals(409, ex.getStatus());
        assertEquals("moduleAlreadyActive", ex.getCode());
    }

    @Test
    void refusesAModuleThatIsNotForSale() {
        Tenant tenant = tenant();

        AuthException ex =
                assertThrows(
                        AuthException.class,
                        () ->
                                service.addModules(
                                        tenant, new AddModulesRequest(List.of("accounting"))));

        assertEquals(400, ex.getStatus());
        assertEquals("unknownModule", ex.getCode());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setPlanId("starter");
        return tenant;
    }
}

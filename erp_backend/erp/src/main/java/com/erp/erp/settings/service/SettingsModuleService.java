package com.erp.erp.settings.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.dto.BillingUrlResponse;
import com.erp.erp.billing.service.ModuleCatalog;
import com.erp.erp.billing.service.SubscriptionUpgradeService;
import com.erp.erp.settings.dto.AddModulesRequest;
import com.erp.erp.settings.dto.ModuleCatalogResponse;
import com.erp.erp.settings.dto.ModuleOfferResponse;
import com.erp.erp.settings.dto.ModulePurchaseResponse;
import com.erp.erp.tenant.model.Tenant;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The modules a workspace can add after its signup. Only the modules that
 * are missing are charged; the prerequisites come with them.
 */
@Service
public class SettingsModuleService {

    private final ModuleCatalog modules;
    private final SubscriptionUpgradeService upgrades;

    public SettingsModuleService(ModuleCatalog modules, SubscriptionUpgradeService upgrades) {
        this.modules = modules;
        this.upgrades = upgrades;
    }

    @Transactional(readOnly = true)
    public ModuleCatalogResponse catalog(Tenant tenant) {
        List<ModuleOfferResponse> offers =
                modules.offers().stream()
                        .map(
                                offer ->
                                        new ModuleOfferResponse(
                                                offer.id(),
                                                offer.priceMonthly(),
                                                offer.currency(),
                                                modules.dependenciesOf(offer.id()),
                                                offer.saleable()))
                        .toList();

        return new ModuleCatalogResponse(
                tenant.getPlanId(), tenant.getModuleList(), offers);
    }

    /** Sends the customer to the Stripe page that charges the new modules. */
    @Transactional
    public ModulePurchaseResponse addModules(Tenant tenant, AddModulesRequest request) {
        List<String> requested = request.modules() == null ? List.of() : request.modules();
        if (requested.isEmpty()) {
            throw new AuthException(400, "no module selected", "noModuleSelected");
        }

        List<String> sellable = new ArrayList<>();
        for (String moduleId : requested) {
            if (modules.stripePriceFor(moduleId) != null) {
                sellable.add(moduleId);
            }
        }
        if (sellable.isEmpty()) {
            throw new AuthException(400, "no module for sale was selected", "unknownModule");
        }

        // A requested module must be for sale or a prerequisite of a module for sale.
        for (String moduleId : requested) {
            if (modules.stripePriceFor(moduleId) != null) {
                continue;
            }
            boolean prerequisite =
                    sellable.stream()
                            .anyMatch(sale -> modules.dependenciesOf(sale).contains(moduleId));
            if (!prerequisite) {
                throw new AuthException(
                        400, "module is not available: " + moduleId, "unknownModule");
            }
        }

        Set<String> enabled = new LinkedHashSet<>(tenant.getModuleList());
        List<String> toBuy = new ArrayList<>();
        for (String moduleId : sellable) {
            if (enabled.contains(moduleId) || toBuy.contains(moduleId)) {
                continue;
            }
            toBuy.add(moduleId);
        }
        if (toBuy.isEmpty()) {
            throw new AuthException(
                    409, "these modules are already active", "moduleAlreadyActive");
        }

        BillingUrlResponse payment = upgrades.addModules(tenant, toBuy);
        BigDecimal total =
                toBuy.stream().map(modules::priceOf).reduce(BigDecimal.ZERO, BigDecimal::add);

        return new ModulePurchaseResponse(payment.url(), total, toBuy);
    }
}

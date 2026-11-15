package com.erp.erp.billing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.billing.config.ModuleProperties;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * The modules a workspace can buy on top of its plan, with their monthly
 * price and the Stripe price used to charge them.
 */
@Service
public class ModuleCatalog {

    /** Modules that can be bought separately, with the modules they need. */
    private static final Map<String, List<String>> DEPENDENCIES =
            Map.of(
                    "stock", List.of("products"),
                    "purchases", List.of("contacts", "products"),
                    "accounting", List.of("invoices", "purchases"),
                    "reports", List.of(),
                    "hr", List.of(),
                    "support", List.of(),
                    "marketing", List.of(),
                    "ai-assistant", List.of(),
                    "room-live", List.of());

    private final ModuleProperties properties;

    public ModuleCatalog(ModuleProperties properties) {
        this.properties = properties;
    }

    /** One module offered for sale. */
    public record ModuleOffer(
            String id, BigDecimal priceMonthly, String currency, boolean saleable) {}

    /**
     * Every module that has a monthly price. A module is only sellable when
     * its Stripe price is configured.
     */
    public List<ModuleOffer> offers() {
        List<ModuleOffer> offers = new ArrayList<>();
        for (Map.Entry<String, BigDecimal> entry : properties.prices().entrySet()) {
            offers.add(
                    new ModuleOffer(
                            entry.getKey(),
                            entry.getValue(),
                            "USD",
                            stripePriceFor(entry.getKey()) != null));
        }
        offers.sort(Comparator.comparing(ModuleOffer::id));
        return offers;
    }

    public Optional<ModuleOffer> offer(String moduleId) {
        return offers().stream().filter(offer -> offer.id().equals(moduleId)).findFirst();
    }

    /** The Stripe price id of a module, or null when it is not for sale. */
    public String stripePriceFor(String moduleId) {
        if (moduleId == null) {
            return null;
        }
        String priceId = properties.stripePrices().get(moduleId);
        return priceId == null || priceId.isBlank() ? null : priceId;
    }

    /** The module a Stripe price pays for, when it is a module price. */
    public Optional<String> moduleFor(String stripePriceId) {
        if (stripePriceId == null || stripePriceId.isBlank()) {
            return Optional.empty();
        }
        return properties.stripePrices().entrySet().stream()
                .filter(entry -> entry.getValue().equals(stripePriceId))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    /** The modules a module needs, plus the module itself. */
    public List<String> withDependencies(String moduleId) {
        List<String> modules = new ArrayList<>();
        modules.add(moduleId);
        modules.addAll(DEPENDENCIES.getOrDefault(moduleId, List.of()));
        return modules;
    }

    /** The dependencies of a module. */
    public List<String> dependenciesOf(String moduleId) {
        return DEPENDENCIES.getOrDefault(moduleId, List.of());
    }

    /** Throws when the module cannot be sold. */
    public void requireSellable(String moduleId) {
        if (stripePriceFor(moduleId) == null) {
            throw new AuthException(400, "module is not available: " + moduleId, "unknownModule");
        }
    }

    /** The monthly price of a module. */
    public BigDecimal priceOf(String moduleId) {
        BigDecimal price = properties.prices().get(moduleId);
        return price == null ? BigDecimal.ZERO : price;
    }

    /** The modules of a subscription, read from its Stripe items. */
    public Map<String, String> modulesOf(List<String> stripePriceIds) {
        Map<String, String> modules = new LinkedHashMap<>();
        for (String priceId : stripePriceIds) {
            moduleFor(priceId).ifPresent(moduleId -> modules.put(moduleId, priceId));
        }
        return modules;
    }
}

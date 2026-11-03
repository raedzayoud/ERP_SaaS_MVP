package com.erp.erp.auth.service;

import com.erp.erp.auth.exception.AuthException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Derives the cheapest plan that contains every requested module.
 * The plan ids and module lists mirror the Angular plans.ts file.
 */
public final class PlanResolver {

    private static final Set<String> NEUTRAL_MODULES = Set.of("invoicing", "collab");

    private static final Set<String> KNOWN_MODULES = Set.of(
            "dashboard", "contacts", "products", "sales", "invoices", "payments",
            "purchases", "stock", "accounting", "invoicing", "reports",
            "ai-assistant", "room-live", "collab");

    private static final Map<String, Set<String>> PLANS = Map.of(
            "starter", Set.of("dashboard", "contacts", "products", "sales", "invoices", "payments"),
            "business", Set.of(
                    "dashboard", "contacts", "products", "sales", "invoices", "payments",
                    "purchases", "stock", "accounting", "reports"),
            "enterprise", Set.of(
                    "dashboard", "contacts", "products", "sales", "invoices", "payments",
                    "purchases", "stock", "accounting", "reports", "ai-assistant", "room-live"));

    private static final List<String> ORDERED_PLANS = List.of("starter", "business", "enterprise");

    private PlanResolver() {}

    public static String resolve(List<String> modules) {
        Set<String> requested = new LinkedHashSet<>();
        if (modules != null) {
            for (String module : modules) {
                String value = module == null ? "" : module.trim().toLowerCase(Locale.ROOT);
                if (value.isEmpty()) {
                    continue;
                }
                if (!KNOWN_MODULES.contains(value)) {
                    throw new AuthException(400, "unknown module: " + module);
                }
                if (!NEUTRAL_MODULES.contains(value)) {
                    requested.add(value);
                }
            }
        }

        for (String plan : ORDERED_PLANS) {
            if (PLANS.get(plan).containsAll(requested)) {
                return plan;
            }
        }
        return "starter";
    }
}

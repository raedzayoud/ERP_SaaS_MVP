package com.erp.erp.auth.permission;

import com.erp.erp.user.model.Role;
import java.util.Collections;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Permissions of each built-in role.
 * Mirrors the Angular matrix in src/app/core/models/rbac.ts so the frontend
 * can read the same map from the access token.
 */
public final class RolePermissions {

    private static final List<String> ALL_MODULES = List.of(
            "dashboard",
            "apps",
            "contacts",
            "products",
            "sales",
            "invoices",
            "payments",
            "purchases",
            "stock",
            "accounting",
            "invoicing",
            "reports",
            "ai-assistant",
            "collab",
            "hr",
            "support",
            "settings");

    private static final List<String> VIEW = List.of("view");
    private static final List<String> VIEW_EXPORT = List.of("view", "export");
    private static final List<String> FULL_EDIT = List.of("view", "create", "update", "export");
    private static final List<String> FULL_CYCLE =
            List.of("view", "create", "update", "delete", "validate", "export");

    private static final Map<Role, Map<String, List<String>>> BY_ROLE = build();

    private RolePermissions() {}

    /** Returns the permissions of the role, or an empty map when it has none. */
    public static Map<String, List<String>> of(Role role) {
        return BY_ROLE.getOrDefault(role, Map.of());
    }

    private static Map<Role, Map<String, List<String>>> build() {
        Map<Role, Map<String, List<String>>> roles = new EnumMap<>(Role.class);

        Map<String, List<String>> admin = new LinkedHashMap<>();
        for (String module : ALL_MODULES) {
            admin.put(module, FULL_CYCLE);
        }
        roles.put(Role.ADMIN_ENTREPRISE, Collections.unmodifiableMap(admin));

        roles.put(Role.COMMERCIAL, commercial());
        roles.put(Role.ACHETEUR, acheteur());
        roles.put(Role.MAGASINIER, magasinier());
        roles.put(Role.COMPTABLE, comptable());
        roles.put(Role.DIRECTEUR, directeur());
        roles.put(Role.SUPER_ADMIN, Map.of());
        roles.put(Role.CLIENT_EXTERNE, Map.of());

        return Collections.unmodifiableMap(roles);
    }

    private static Map<String, List<String>> commercial() {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        permissions.put("dashboard", VIEW);
        permissions.put("apps", VIEW);
        permissions.put("collab", VIEW);
        permissions.put("ai-assistant", VIEW);
        permissions.put("contacts", FULL_EDIT);
        permissions.put("products", FULL_EDIT);
        permissions.put("sales", FULL_CYCLE);
        permissions.put("invoices", FULL_CYCLE);
        permissions.put("payments", List.of("view", "create", "update", "export", "validate"));
        permissions.put("reports", VIEW_EXPORT);
        permissions.put("support", VIEW);
        return Collections.unmodifiableMap(permissions);
    }

    private static Map<String, List<String>> acheteur() {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        permissions.put("dashboard", VIEW);
        permissions.put("apps", VIEW);
        permissions.put("collab", VIEW);
        permissions.put("contacts", FULL_EDIT);
        permissions.put("products", List.of("view", "update", "export"));
        permissions.put("purchases", FULL_CYCLE);
        permissions.put("reports", VIEW_EXPORT);
        return Collections.unmodifiableMap(permissions);
    }

    private static Map<String, List<String>> magasinier() {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        permissions.put("dashboard", VIEW);
        permissions.put("apps", VIEW);
        permissions.put("collab", VIEW);
        permissions.put("products", List.of("view", "update"));
        permissions.put("stock", FULL_CYCLE);
        return Collections.unmodifiableMap(permissions);
    }

    private static Map<String, List<String>> comptable() {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        permissions.put("dashboard", VIEW);
        permissions.put("apps", VIEW);
        permissions.put("collab", VIEW);
        permissions.put("invoices", List.of("view", "update", "validate", "export"));
        permissions.put("payments", FULL_CYCLE);
        permissions.put("purchases", VIEW_EXPORT);
        permissions.put("accounting", FULL_EDIT);
        permissions.put("invoicing", List.of("view", "update", "export"));
        permissions.put("reports", VIEW_EXPORT);
        return Collections.unmodifiableMap(permissions);
    }

    private static Map<String, List<String>> directeur() {
        Map<String, List<String>> permissions = new LinkedHashMap<>();
        permissions.put("dashboard", VIEW_EXPORT);
        permissions.put("apps", VIEW);
        permissions.put("collab", VIEW);
        permissions.put("contacts", VIEW_EXPORT);
        permissions.put("products", VIEW_EXPORT);
        permissions.put("sales", List.of("view", "validate", "export"));
        permissions.put("invoices", List.of("view", "validate", "export"));
        permissions.put("payments", List.of("view", "validate", "export"));
        permissions.put("purchases", List.of("view", "validate", "export"));
        permissions.put("stock", VIEW_EXPORT);
        permissions.put("accounting", VIEW_EXPORT);
        permissions.put("reports", VIEW_EXPORT);
        permissions.put("hr", List.of("view", "validate", "export"));
        permissions.put("support", List.of("view", "validate", "export"));
        return Collections.unmodifiableMap(permissions);
    }
}

package com.erp.erp.auth.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.erp.erp.user.model.Role;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RolePermissionsTest {

    @Test
    void adminHasEveryActionOnEveryModule() {
        Map<String, List<String>> permissions = RolePermissions.of(Role.ADMIN_ENTREPRISE);

        assertEquals(17, permissions.size());
        assertEquals(List.of("view", "create", "update", "delete", "validate", "export"),
                permissions.get("settings"));
    }

    @Test
    void commercialCanManageSalesButNotAccounting() {
        Map<String, List<String>> permissions = RolePermissions.of(Role.COMMERCIAL);

        assertTrue(permissions.get("sales").contains("create"));
        assertTrue(permissions.get("sales").contains("delete"));
        assertTrue(permissions.containsKey("collab"));
        assertFalse(permissions.containsKey("accounting"));
        assertEquals(List.of("view"), permissions.get("support"));
    }

    @Test
    void directorCanValidateButCannotCreateInvoices() {
        Map<String, List<String>> permissions = RolePermissions.of(Role.DIRECTEUR);

        assertTrue(permissions.get("invoices").contains("validate"));
        assertFalse(permissions.get("invoices").contains("create"));
        assertFalse(permissions.get("invoices").contains("delete"));
        assertEquals(List.of("view", "validate", "export"), permissions.get("hr"));
        assertEquals(List.of("view", "validate", "export"), permissions.get("support"));
    }

    @Test
    void platformAndExternalRolesHaveNoWorkspacePermissions() {
        assertTrue(RolePermissions.of(Role.SUPER_ADMIN).isEmpty());
        assertTrue(RolePermissions.of(Role.CLIENT_EXTERNE).isEmpty());
    }
}

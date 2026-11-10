package com.erp.erp.auth.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.erp.erp.auth.exception.AuthException;
import java.util.List;
import org.junit.jupiter.api.Test;

class PlanResolverTest {

    @Test
    void starterWhenOnlyStarterModules() {
        assertEquals("starter", PlanResolver.resolve(
                List.of("dashboard", "contacts", "products", "sales", "invoices", "payments")));
    }

    @Test
    void businessWhenStock() {
        assertEquals("business", PlanResolver.resolve(List.of("dashboard", "stock")));
    }

    @Test
    void businessWhenAccounting() {
        assertEquals("business", PlanResolver.resolve(List.of("dashboard", "accounting")));
    }

    @Test
    void businessWhenHrOrSupport() {
        assertEquals("business", PlanResolver.resolve(List.of("dashboard", "hr")));
        assertEquals("business", PlanResolver.resolve(List.of("dashboard", "support")));
    }

    @Test
    void businessWhenMarketing() {
        assertEquals("business", PlanResolver.resolve(List.of("dashboard", "marketing")));
    }

    @Test
    void enterpriseWhenAiAssistant() {
        assertEquals("enterprise", PlanResolver.resolve(List.of("dashboard", "ai-assistant")));
    }

    @Test
    void enterpriseWhenRoomLive() {
        assertEquals("enterprise", PlanResolver.resolve(List.of("dashboard", "room-live")));
    }

    @Test
    void neutralModulesDoNotUpgradeThePlan() {
        assertEquals("starter", PlanResolver.resolve(
                List.of("dashboard", "invoicing", "collab")));
    }

    @Test
    void unknownModuleIsRejected() {
        AuthException ex = assertThrows(
                AuthException.class, () -> PlanResolver.resolve(List.of("payroll")));

        assertEquals(400, ex.getStatus());
    }

    @Test
    void selectedPlanIsReturnedWhenItContainsEveryModule() {
        assertEquals("business", PlanResolver.resolve(
                "business", List.of("dashboard", "stock", "accounting")));
    }

    @Test
    void selectedPlanCannotBeCheaperThanTheRequestedModules() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> PlanResolver.resolve("starter", List.of("dashboard", "stock")));

        assertEquals(400, ex.getStatus());
        assertEquals("plan does not include all selected modules", ex.getMessage());
    }

    @Test
    void selectedPlanIsCaseInsensitive() {
        assertEquals("starter", PlanResolver.resolve(
                "STARTER", List.of("dashboard", "invoices")));
    }

    @Test
    void unknownSelectedPlanIsRejected() {
        AuthException ex = assertThrows(
                AuthException.class,
                () -> PlanResolver.resolve("gold", List.of("dashboard")));

        assertEquals(400, ex.getStatus());
    }
}

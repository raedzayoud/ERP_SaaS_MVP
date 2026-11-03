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
}

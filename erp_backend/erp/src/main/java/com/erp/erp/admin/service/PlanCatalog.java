package com.erp.erp.admin.service;

import com.erp.erp.admin.dto.AdminPlanResponse;
import com.erp.erp.billing.model.BillingInterval;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Read-only plan catalog for the super-admin console.
 * Keep these values in sync with the Angular plans.ts file until signup reads
 * the catalog from the backend.
 */
@Service
public class PlanCatalog {

    private static final List<AdminPlanResponse> PLANS = List.of(
            new AdminPlanResponse(
                    "starter",
                    "Starter",
                    29,
                    278,
                    3,
                    1,
                    0,
                    List.of("dashboard", "contacts", "products", "sales", "invoices", "payments", "collab"),
                    List.of(
                            "Up to 3 users",
                            "1 GB storage",
                            "CRM & Contacts",
                            "Product catalog",
                            "Invoicing & Payments",
                            "Rooms live included",
                            "Email support"),
                    false),
            new AdminPlanResponse(
                    "business",
                    "Business",
                    79,
                    758,
                    15,
                    10,
                    100,
                    List.of(
                            "dashboard",
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
                            "collab",
                            "hr",
                            "support",
                            "marketing"),
                    List.of(
                            "Up to 15 users",
                            "10 GB storage",
                            "Everything in Starter",
                            "Purchases & Stock",
                            "Accounting & Reports",
                            "HR & Support",
                            "Marketing & promotions",
                            "100 AI queries/month",
                            "Rooms live included",
                            "Priority support"),
                    true),
            new AdminPlanResponse(
                    "enterprise",
                    "Enterprise",
                    199,
                    1910,
                    999,
                    100,
                    1000,
                    List.of(
                            "dashboard",
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
                            "room-live",
                            "collab",
                            "hr",
                            "support",
                            "marketing"),
                    List.of(
                            "Unlimited users",
                            "100 GB storage",
                            "Everything in Business",
                            "HR & Support",
                            "AI Assistant (RAG)",
                            "1,000 AI queries/month",
                            "Advanced analytics",
                            "Rooms live included",
                            "Dedicated support",
                            "Custom integrations"),
                    false));

    public List<AdminPlanResponse> all() {
        return PLANS;
    }

    public AdminPlanResponse byId(String planId) {
        return PLANS.stream()
                .filter(plan -> plan.id().equals(planId))
                .findFirst()
                .orElse(PLANS.get(0));
    }

    /** Monthly-equivalent price used by the dashboard revenue estimate. */
    public double monthlyEquivalent(String planId, BillingInterval interval) {
        AdminPlanResponse plan = byId(planId);
        if (interval == BillingInterval.ANNUAL) {
            return plan.priceAnnual() / 12.0;
        }
        return plan.priceMonthly();
    }
}

package com.erp.erp.settings.service;

import java.util.Map;

/** User limits per plan, mirroring the Angular plans.ts file. */
public final class PlanLimits {

    private static final Map<String, Integer> MAX_USERS = Map.of(
            "starter", 3,
            "business", 15,
            "enterprise", 999);

    private PlanLimits() {}

    public static int maxUsers(String planId) {
        return planId == null ? MAX_USERS.get("starter") : MAX_USERS.getOrDefault(planId, MAX_USERS.get("starter"));
    }
}

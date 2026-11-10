package com.erp.erp.admin.controller;

import com.erp.erp.admin.dto.AdminPlanResponse;
import com.erp.erp.admin.service.PlanCatalog;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only plan catalog for the super-admin console. */
@RestController
@RequestMapping("/api/v1/admin/plans")
public class AdminPlanController {

    private final PlanCatalog planCatalog;

    public AdminPlanController(PlanCatalog planCatalog) {
        this.planCatalog = planCatalog;
    }

    @GetMapping
    public List<AdminPlanResponse> list() {
        return planCatalog.all();
    }
}

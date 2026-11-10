package com.erp.erp.admin.controller;

import com.erp.erp.admin.dto.AdminPaymentResponse;
import com.erp.erp.admin.service.AdminPaymentService;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Read-only Stripe invoice view for the super-admin console. */
@RestController
@RequestMapping("/api/v1/admin/payments")
public class AdminPaymentController {

    private final AdminPaymentService paymentService;

    public AdminPaymentController(AdminPaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @GetMapping
    public List<AdminPaymentResponse> list() {
        return paymentService.list();
    }
}

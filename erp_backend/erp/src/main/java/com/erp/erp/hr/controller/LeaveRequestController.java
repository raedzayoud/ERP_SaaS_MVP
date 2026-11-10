package com.erp.erp.hr.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.hr.dto.LeaveRequestRequest;
import com.erp.erp.hr.dto.LeaveRequestResponse;
import com.erp.erp.hr.dto.LeaveStatusRequest;
import com.erp.erp.hr.service.LeaveRequestService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hr/leave-requests")
public class LeaveRequestController {

    private final LeaveRequestService service;
    private final CurrentTenantService currentTenant;

    public LeaveRequestController(
            LeaveRequestService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<LeaveRequestResponse> list(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) UUID employeeId) {
        Tenant tenant = tenant(jwt);
        return service.list(tenant, status, employeeId);
    }

    @PostMapping
    public ResponseEntity<LeaveRequestResponse> create(
            @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody LeaveRequestRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(tenant(jwt), request));
    }

    @PutMapping("/{id}/status")
    public LeaveRequestResponse updateStatus(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody LeaveStatusRequest request) {
        return service.updateStatus(tenant(jwt), id, request.status());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "hr");
        return tenant;
    }
}

package com.erp.erp.hr.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.hr.dto.LeaveRequestRequest;
import com.erp.erp.hr.dto.LeaveRequestResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.LeaveRequest;
import com.erp.erp.hr.model.LeaveStatus;
import com.erp.erp.hr.model.LeaveType;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeaveRequestService {

    private final LeaveRequestRepository leaveRequests;
    private final EmployeeRepository employees;

    public LeaveRequestService(
            LeaveRequestRepository leaveRequests, EmployeeRepository employees) {
        this.leaveRequests = leaveRequests;
        this.employees = employees;
    }

    @Transactional(readOnly = true)
    public List<LeaveRequestResponse> list(Tenant tenant, String status, UUID employeeId) {
        LeaveStatus filter = status == null || status.isBlank() ? null : parseStatus(status);

        return leaveRequests.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(request -> filter == null || request.getStatus() == filter)
                .filter(request -> employeeId == null
                        || request.getEmployee().getId().equals(employeeId))
                .map(LeaveRequestResponse::from)
                .toList();
    }

    @Transactional
    public LeaveRequestResponse create(Tenant tenant, LeaveRequestRequest request) {
        if (request.endDate().isBefore(request.startDate())) {
            throw new AuthException(400, "endDate must not be before startDate");
        }

        Employee employee = employees
                .findByIdAndTenantId(request.employeeId(), tenant.getId())
                .orElseThrow(() -> new AuthException(404, "employee not found"));

        LeaveRequest leaveRequest = new LeaveRequest();
        leaveRequest.setTenant(tenant);
        leaveRequest.setEmployee(employee);
        leaveRequest.setType(parseType(request.type()));
        leaveRequest.setStartDate(request.startDate());
        leaveRequest.setEndDate(request.endDate());
        leaveRequest.setReason(request.reason());
        leaveRequest.setStatus(LeaveStatus.PENDING);

        return LeaveRequestResponse.from(leaveRequests.save(leaveRequest));
    }

    @Transactional
    public LeaveRequestResponse updateStatus(Tenant tenant, UUID id, String status) {
        LeaveRequest request = find(tenant, id);
        request.setStatus(parseStatus(status));
        return LeaveRequestResponse.from(leaveRequests.save(request));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        leaveRequests.delete(find(tenant, id));
    }

    private LeaveRequest find(Tenant tenant, UUID id) {
        return leaveRequests
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "leave request not found"));
    }

    private LeaveType parseType(String value) {
        try {
            return LeaveType.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid leave type");
        }
    }

    private LeaveStatus parseStatus(String value) {
        try {
            return LeaveStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid leave status");
        }
    }
}

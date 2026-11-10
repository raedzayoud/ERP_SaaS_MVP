package com.erp.erp.hr.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.hr.dto.EmployeeRequest;
import com.erp.erp.hr.dto.EmployeeResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.EmployeeStatus;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeService {

    private final EmployeeRepository employees;
    private final LeaveRequestRepository leaveRequests;

    public EmployeeService(
            EmployeeRepository employees, LeaveRequestRepository leaveRequests) {
        this.employees = employees;
        this.leaveRequests = leaveRequests;
    }

    @Transactional(readOnly = true)
    public List<EmployeeResponse> list(Tenant tenant, String search, String status) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        EmployeeStatus filter = status == null || status.isBlank() ? null : parseStatus(status);

        return employees.findByTenantIdOrderByFullNameAsc(tenant.getId()).stream()
                .filter(employee -> filter == null || employee.getStatus() == filter)
                .filter(employee -> query.isEmpty() || matches(employee, query))
                .map(EmployeeResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public EmployeeResponse get(Tenant tenant, UUID id) {
        return EmployeeResponse.from(find(tenant, id));
    }

    @Transactional
    public EmployeeResponse create(Tenant tenant, EmployeeRequest request) {
        Employee employee = new Employee();
        employee.setTenant(tenant);
        apply(employee, request);
        return EmployeeResponse.from(employees.save(employee));
    }

    @Transactional
    public EmployeeResponse update(Tenant tenant, UUID id, EmployeeRequest request) {
        Employee employee = find(tenant, id);
        apply(employee, request);
        employee.setUpdatedAt(Instant.now());
        return EmployeeResponse.from(employees.save(employee));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        Employee employee = find(tenant, id);
        if (leaveRequests.existsByEmployeeIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(409, "employee has leave requests");
        }
        employees.delete(employee);
    }

    private Employee find(Tenant tenant, UUID id) {
        return employees
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "employee not found"));
    }

    private void apply(Employee employee, EmployeeRequest request) {
        employee.setFullName(request.fullName().trim());
        employee.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        employee.setPhone(request.phone());
        employee.setDepartment(request.department().trim());
        employee.setPosition(request.position().trim());
        employee.setHireDate(request.hireDate());
        if (request.status() != null && !request.status().isBlank()) {
            employee.setStatus(parseStatus(request.status()));
        }
    }

    private EmployeeStatus parseStatus(String value) {
        try {
            return EmployeeStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid employee status");
        }
    }

    private boolean matches(Employee employee, String query) {
        return contains(employee.getFullName(), query)
                || contains(employee.getEmail(), query)
                || contains(employee.getDepartment(), query)
                || contains(employee.getPosition(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}

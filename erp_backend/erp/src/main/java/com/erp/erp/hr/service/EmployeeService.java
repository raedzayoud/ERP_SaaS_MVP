package com.erp.erp.hr.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.hr.dto.EmployeeRequest;
import com.erp.erp.hr.dto.EmployeeResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.EmployeeStatus;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.settings.service.PlanLimits;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmployeeService {

    private final EmployeeRepository employees;
    private final LeaveRequestRepository leaveRequests;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public EmployeeService(
            EmployeeRepository employees,
            LeaveRequestRepository leaveRequests,
            UserRepository users,
            PasswordEncoder passwordEncoder) {
        this.employees = employees;
        this.leaveRequests = leaveRequests;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
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
        employee.setUser(createAccount(tenant, employee, request.password()));
        return EmployeeResponse.from(employees.save(employee));
    }

    @Transactional
    public EmployeeResponse update(Tenant tenant, UUID id, EmployeeRequest request) {
        Employee employee = find(tenant, id);
        apply(employee, request);
        employee.setUpdatedAt(Instant.now());
        User account = employee.getUser();
        if (account != null && account.getRole() != employee.getRole()) {
            // shortcut: the account email is not resynced when the employee
            // email changes, upgrade when the app needs email changes.
            account.setRole(employee.getRole());
            users.save(account);
        }
        return EmployeeResponse.from(employees.save(employee));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        Employee employee = find(tenant, id);
        if (leaveRequests.existsByEmployeeIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(409, "employee has leave requests", "employeeHasLeaveRequests");
        }
        User account = employee.getUser();
        if (account != null) {
            account.setActive(false);
            users.save(account);
        }
        employees.delete(employee);
    }

    /**
     * Creates the login account of a new employee. The password is mandatory:
     * no email is sent, the administrator gives it to the employee.
     */
    private User createAccount(Tenant tenant, Employee employee, String password) {
        if (password == null || password.isBlank()) {
            throw new AuthException(400, "password required", "invalidPassword");
        }
        if (password.length() < 8) {
            throw new AuthException(400, "password too short", "invalidPassword");
        }
        if (users.existsByEmail(employee.getEmail())) {
            throw new AuthException(409, "email already in use", "emailTaken");
        }
        if (users.countByTenantId(tenant.getId()) >= PlanLimits.maxUsers(tenant.getPlanId())) {
            throw new AuthException(409, "plan user limit reached", "planUserLimit");
        }

        User account = new User();
        account.setFullName(employee.getFullName());
        account.setEmail(employee.getEmail());
        account.setPasswordHash(passwordEncoder.encode(password));
        account.setRole(employee.getRole());
        account.setActive(true);
        account.setMustRenewPassword(true);
        account.setTenant(tenant);
        return users.save(account);
    }

    private Employee find(Tenant tenant, UUID id) {
        return employees
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "employee not found", "notFound"));
    }

    private void apply(Employee employee, EmployeeRequest request) {
        employee.setFullName(request.fullName().trim());
        employee.setEmail(request.email().trim().toLowerCase(Locale.ROOT));
        employee.setPhone(request.phone() == null ? "" : request.phone().trim());
        employee.setRole(parseRole(request.role()));
        // shortcut: the legacy department column is still NOT NULL in the
        // existing databases, so it receives the role code until it is dropped.
        employee.setDepartment(employee.getRole().getCode());
        employee.setPosition(request.position() == null ? "" : request.position().trim());
        employee.setHireDate(request.hireDate());
        if (request.status() != null && !request.status().isBlank()) {
            employee.setStatus(parseStatus(request.status()));
        }
    }

    private EmployeeStatus parseStatus(String value) {
        try {
            return EmployeeStatus.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid employee status", "invalidStatus");
        }
    }

    private Role parseRole(String value) {
        try {
            return Role.fromCode(value.trim().toLowerCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new AuthException(400, "invalid employee role", "invalidRole");
        }
    }

    private boolean matches(Employee employee, String query) {
        return contains(employee.getFullName(), query)
                || contains(employee.getEmail(), query)
                || contains(employee.getRole() == null ? null : employee.getRole().getCode(), query)
                || contains(employee.getPosition(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}

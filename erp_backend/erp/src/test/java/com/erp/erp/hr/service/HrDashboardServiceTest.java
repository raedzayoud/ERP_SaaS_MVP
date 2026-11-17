package com.erp.erp.hr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.erp.erp.hr.dto.HrDashboardResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.EmployeeStatus;
import com.erp.erp.hr.model.LeaveRequest;
import com.erp.erp.hr.model.LeaveStatus;
import com.erp.erp.hr.model.LeaveType;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.Role;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HrDashboardServiceTest {

    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final LeaveRequestRepository leaveRequests = mock(LeaveRequestRepository.class);
    private final HrDashboardService service = new HrDashboardService(employees, leaveRequests);

    @Test
    void countsTheEmployeesTheOnLeaveOnesAndTheRoles() {
        Tenant tenant = tenant();
        when(employees.findByTenantIdOrderByFullNameAsc(tenant.getId()))
                .thenReturn(
                        List.of(
                                employee(tenant, Role.COMMERCIAL, EmployeeStatus.ACTIVE),
                                employee(tenant, Role.COMMERCIAL, EmployeeStatus.ON_LEAVE),
                                employee(tenant, Role.ACHETEUR, EmployeeStatus.ACTIVE)));

        HrDashboardResponse response = service.dashboard(tenant);

        assertEquals(3, response.totalEmployees());
        assertEquals(1, response.onLeave());
        assertEquals(2, response.roles());
    }

    @Test
    void countsThePendingLeaveRequests() {
        Tenant tenant = tenant();
        when(employees.findByTenantIdOrderByFullNameAsc(tenant.getId())).thenReturn(List.of());
        when(leaveRequests.findByTenantIdOrderByCreatedAtDesc(tenant.getId()))
                .thenReturn(
                        List.of(
                                leave(tenant, LeaveStatus.PENDING),
                                leave(tenant, LeaveStatus.APPROVED),
                                leave(tenant, LeaveStatus.REJECTED)));

        HrDashboardResponse response = service.dashboard(tenant);

        assertEquals(0, response.totalEmployees());
        assertEquals(1, response.pendingLeave());
    }

    private Employee employee(Tenant tenant, Role role, EmployeeStatus status) {
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setTenant(tenant);
        employee.setFullName("Ada Lovelace");
        employee.setEmail("ada@example.com");
        employee.setRole(role);
        employee.setPosition("Developer");
        employee.setHireDate(LocalDate.of(2026, 1, 1));
        employee.setStatus(status);
        return employee;
    }

    private LeaveRequest leave(Tenant tenant, LeaveStatus status) {
        LeaveRequest request = new LeaveRequest();
        request.setId(UUID.randomUUID());
        request.setTenant(tenant);
        request.setEmployee(employee(tenant, Role.COMMERCIAL, EmployeeStatus.ACTIVE));
        request.setType(LeaveType.ANNUAL);
        request.setStartDate(LocalDate.of(2026, 5, 10));
        request.setEndDate(LocalDate.of(2026, 5, 12));
        request.setStatus(status);
        return request;
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }
}

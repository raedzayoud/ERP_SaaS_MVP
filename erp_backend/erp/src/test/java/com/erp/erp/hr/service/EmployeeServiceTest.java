package com.erp.erp.hr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.hr.dto.EmployeeRequest;
import com.erp.erp.hr.dto.EmployeeResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.EmployeeStatus;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class EmployeeServiceTest {

    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final LeaveRequestRepository leaveRequests = mock(LeaveRequestRepository.class);
    private final EmployeeService service = new EmployeeService(employees, leaveRequests);

    @Test
    void createsAnEmployeeWithNormalizedEmailAndDefaultStatus() {
        Tenant tenant = tenant();
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));

        EmployeeResponse response = service.create(
                tenant,
                new EmployeeRequest(
                        " Ada Lovelace ",
                        "ADA@Example.com",
                        null,
                        "Engineering",
                        "Developer",
                        LocalDate.of(2026, 1, 1),
                        null));

        assertEquals("ada@example.com", response.email());
        assertEquals("active", response.status());
    }

    @Test
    void rejectsDeletingAnEmployeeWhoHasLeaveRequests() {
        Tenant tenant = tenant();
        Employee employee = employee(tenant);
        when(employees.findByIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(Optional.of(employee));
        when(leaveRequests.existsByEmployeeIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.delete(tenant, employee.getId()));

        assertEquals(409, ex.getStatus());
        verify(employees, never()).delete(any(Employee.class));
    }

    @Test
    void doesNotFindAnEmployeeFromAnotherTenant() {
        Tenant tenant = tenant();
        UUID id = UUID.randomUUID();
        when(employees.findByIdAndTenantId(id, tenant.getId())).thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class, () -> service.get(tenant, id));

        assertEquals(404, ex.getStatus());
    }

    private Tenant tenant() {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        return tenant;
    }

    private Employee employee(Tenant tenant) {
        Employee employee = new Employee();
        employee.setId(UUID.randomUUID());
        employee.setTenant(tenant);
        employee.setFullName("Ada Lovelace");
        employee.setEmail("ada@example.com");
        employee.setDepartment("Engineering");
        employee.setPosition("Developer");
        employee.setHireDate(LocalDate.of(2026, 1, 1));
        employee.setStatus(EmployeeStatus.ACTIVE);
        return employee;
    }
}

package com.erp.erp.hr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.hr.dto.LeaveRequestRequest;
import com.erp.erp.hr.dto.LeaveRequestResponse;
import com.erp.erp.hr.model.Employee;
import com.erp.erp.hr.model.LeaveRequest;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LeaveRequestServiceTest {

    private final LeaveRequestRepository leaveRequests = mock(LeaveRequestRepository.class);
    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final LeaveRequestService service = new LeaveRequestService(leaveRequests, employees);

    @Test
    void rejectsAnEndDateBeforeTheStartDate() {
        LeaveRequestRequest request = new LeaveRequestRequest(
                UUID.randomUUID(),
                "annual",
                LocalDate.of(2026, 5, 10),
                LocalDate.of(2026, 5, 9),
                null);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.create(tenant(), request));

        assertEquals(400, ex.getStatus());
        verify(employees, never()).findByIdAndTenantId(any(), any());
    }

    @Test
    void createsAPendingLeaveRequest() {
        Tenant tenant = tenant();
        Employee employee = employee(tenant);
        when(employees.findByIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(Optional.of(employee));
        when(leaveRequests.save(any(LeaveRequest.class)))
                .thenAnswer(call -> call.getArgument(0));

        LeaveRequestResponse response = service.create(
                tenant,
                new LeaveRequestRequest(
                        employee.getId(),
                        "annual",
                        LocalDate.of(2026, 5, 10),
                        LocalDate.of(2026, 5, 12),
                        "Family trip"));

        assertEquals("pending", response.status());
        assertEquals(employee.getId(), response.employeeId());
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
        return employee;
    }
}

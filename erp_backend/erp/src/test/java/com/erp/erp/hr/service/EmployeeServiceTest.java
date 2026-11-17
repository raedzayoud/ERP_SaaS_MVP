package com.erp.erp.hr.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
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
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class EmployeeServiceTest {

    private final EmployeeRepository employees = mock(EmployeeRepository.class);
    private final LeaveRequestRepository leaveRequests = mock(LeaveRequestRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder passwordEncoder = mock(PasswordEncoder.class);
    private final EmployeeService service =
            new EmployeeService(employees, leaveRequests, users, passwordEncoder);

    @Test
    void createsAnEmployeeWithNormalizedEmailAndDefaultStatus() {
        Tenant tenant = tenant();
        stubAccountCreation();

        EmployeeResponse response = service.create(
                tenant,
                request(" Ada Lovelace ", "ADA@Example.com", "commercial", "secret123"));

        assertEquals("ada@example.com", response.email());
        assertEquals("active", response.status());
    }

    @Test
    void storesTheRoleGivenByItsCode() {
        Tenant tenant = tenant();
        stubAccountCreation();

        EmployeeResponse response = service.create(
                tenant,
                request("Ada Lovelace", "ada@example.com", "acheteur", "secret123"));

        assertEquals("acheteur", response.role());
    }

    @Test
    void rejectsAnUnknownRole() {
        Tenant tenant = tenant();

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant, request("Ada Lovelace", "ada@example.com", "directeur commercial", null)));

        assertEquals(400, ex.getStatus());
        assertEquals("invalidRole", ex.getCode());
    }

    @Test
    void serializesTheOnLeaveStatusInSnakeCase() {
        Employee employee = employee(tenant());
        employee.setStatus(EmployeeStatus.ON_LEAVE);

        EmployeeResponse response = EmployeeResponse.from(employee);

        assertEquals("on_leave", response.status());
    }

    @Test
    void storesAnEmptyPhoneWhenNoneIsGiven() {
        Tenant tenant = tenant();
        stubAccountCreation();

        EmployeeResponse response = service.create(
                tenant, request("Ada Lovelace", "ada@example.com", "commercial", "secret123"));

        assertEquals("", response.phone());
    }

    @Test
    void alwaysCreatesTheLoginAccount() {
        Tenant tenant = tenant();
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        when(passwordEncoder.encode("secret123")).thenReturn("hashed");

        EmployeeResponse response = service.create(
                tenant, request("Ada Lovelace", "ada@example.com", "acheteur", "secret123"));

        assertTrue(response.hasAccount());
        verify(users).save(any(User.class));
    }

    @Test
    void theNewAccountUsesTheEmployeeData() {
        Tenant tenant = tenant();
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        when(passwordEncoder.encode("secret123")).thenReturn("hashed");

        service.create(
                tenant, request("Ada Lovelace", "ada@example.com", "acheteur", "secret123"));

        org.mockito.ArgumentCaptor<User> captor =
                org.mockito.ArgumentCaptor.forClass(User.class);
        verify(users).save(captor.capture());
        User account = captor.getValue();
        assertEquals("Ada Lovelace", account.getFullName());
        assertEquals("ada@example.com", account.getEmail());
        assertEquals("hashed", account.getPasswordHash());
        assertEquals(Role.ACHETEUR, account.getRole());
        assertTrue(account.isActive());
        assertTrue(account.isMustRenewPassword());
    }

    @Test
    void rejectsACreationWithoutPassword() {
        Tenant tenant = tenant();

        AuthException blank = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant, request("Ada Lovelace", "ada@example.com", "commercial", "  ")));
        AuthException missing = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant, request("Ada Lovelace", "ada@example.com", "commercial", null)));

        assertEquals(400, blank.getStatus());
        assertEquals("invalidPassword", blank.getCode());
        assertEquals(400, missing.getStatus());
        assertEquals("invalidPassword", missing.getCode());
        verify(employees, never()).save(any(Employee.class));
    }

    @Test
    void rejectsAnEmailAlreadyUsedByAnAccount() {
        Tenant tenant = tenant();
        when(users.existsByEmail("ada@example.com")).thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant,
                        request("Ada Lovelace", "ada@example.com", "commercial", "secret123")));

        assertEquals(409, ex.getStatus());
        assertEquals("emailTaken", ex.getCode());
        verify(employees, never()).save(any(Employee.class));
    }

    @Test
    void rejectsTheAccountWhenThePlanUserLimitIsReached() {
        Tenant tenant = tenant();
        when(users.countByTenantId(tenant.getId())).thenReturn(3L);

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant,
                        request("Ada Lovelace", "ada@example.com", "commercial", "secret123")));

        assertEquals(409, ex.getStatus());
        assertEquals("planUserLimit", ex.getCode());
        verify(employees, never()).save(any(Employee.class));
    }

    @Test
    void rejectsAShortPassword() {
        Tenant tenant = tenant();

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.create(
                        tenant, request("Ada Lovelace", "ada@example.com", "commercial", "short")));

        assertEquals(400, ex.getStatus());
        assertEquals("invalidPassword", ex.getCode());
    }

    @Test
    void deactivatesTheAccountWhenTheEmployeeIsDeleted() {
        Tenant tenant = tenant();
        Employee employee = employee(tenant);
        User account = new User();
        account.setActive(true);
        employee.setUser(account);
        when(employees.findByIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(Optional.of(employee));

        service.delete(tenant, employee.getId());

        assertFalse(account.isActive());
        verify(users).save(account);
        verify(employees).delete(employee);
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
        assertEquals("employeeHasLeaveRequests", ex.getCode());
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
        assertEquals("notFound", ex.getCode());
    }

    @Test
    void syncsTheAccountRoleWhenTheEmployeeRoleChanges() {
        Tenant tenant = tenant();
        Employee employee = employee(tenant);
        User account = new User();
        account.setRole(Role.COMMERCIAL);
        employee.setUser(account);
        when(employees.findByIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(Optional.of(employee));
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));

        service.update(
                tenant, employee.getId(), request("Ada Lovelace", "ada@example.com", "acheteur", null));

        assertEquals(Role.ACHETEUR, account.getRole());
        verify(users).save(account);
    }

    @Test
    void doesNotCreateASecondAccountWhenUpdatingWithAPassword() {
        Tenant tenant = tenant();
        Employee employee = employee(tenant);
        when(employees.findByIdAndTenantId(employee.getId(), tenant.getId()))
                .thenReturn(Optional.of(employee));
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));

        EmployeeResponse response = service.update(
                tenant,
                employee.getId(),
                request("Ada Lovelace", "ada@example.com", "commercial", "secret123"));

        assertFalse(response.hasAccount());
        assertNull(employee.getUser());
        verify(users, never()).save(any(User.class));
    }

    private void stubAccountCreation() {
        when(employees.save(any(Employee.class))).thenAnswer(call -> call.getArgument(0));
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        when(passwordEncoder.encode(any(String.class))).thenReturn("hashed");
    }

    private EmployeeRequest request(String name, String email, String role, String password) {
        return new EmployeeRequest(
                name, email, null, role, "Developer", LocalDate.of(2026, 1, 1), null, password);
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
        employee.setRole(Role.COMMERCIAL);
        employee.setPosition("Developer");
        employee.setHireDate(LocalDate.of(2026, 1, 1));
        employee.setStatus(EmployeeStatus.ACTIVE);
        return employee;
    }
}

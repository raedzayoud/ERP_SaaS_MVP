package com.erp.erp.settings.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.settings.dto.CreateTeamMemberRequest;
import com.erp.erp.settings.dto.TeamMemberResponse;
import com.erp.erp.settings.dto.UpdateTeamMemberRequest;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.Role;
import com.erp.erp.user.model.User;
import com.erp.erp.user.repository.UserRepository;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

class SettingsUserServiceTest {

    private final UserRepository users = mock(UserRepository.class);
    private final PasswordEncoder encoder = mock(PasswordEncoder.class);
    private final SettingsUserService service = new SettingsUserService(users, encoder);

    @Test
    void createsATeamMemberWithHashedPassword() {
        Tenant tenant = tenant("starter");
        when(users.save(any(User.class))).thenAnswer(call -> call.getArgument(0));
        when(encoder.encode("secret123")).thenReturn("hashed");

        TeamMemberResponse response = service.create(
                tenant,
                new CreateTeamMemberRequest(
                        " Ada Lovelace ", "ADA@Example.com", "commercial", "secret123", true));

        assertEquals("Ada Lovelace", response.name());
        assertEquals("ada@example.com", response.email());
        assertEquals("commercial", response.role());
        assertTrue(response.active());
        assertTrue(response.mustRenewPassword());
        verify(encoder).encode("secret123");
    }

    @Test
    void rejectsCreationWhenPlanLimitIsReached() {
        Tenant tenant = tenant("starter");
        when(users.countByTenantId(tenant.getId())).thenReturn(3L);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.create(tenant, request("commercial")));

        assertEquals(409, ex.getStatus());
        verify(users, never()).save(any(User.class));
    }

    @Test
    void rejectsADuplicateEmail() {
        Tenant tenant = tenant("starter");
        when(users.existsByEmail("ada@example.com")).thenReturn(true);

        AuthException ex = assertThrows(
                AuthException.class, () -> service.create(tenant, request("commercial")));

        assertEquals(409, ex.getStatus());
        verify(users, never()).save(any(User.class));
    }

    @Test
    void rejectsTheSuperAdminRole() {
        Tenant tenant = tenant("starter");

        AuthException ex = assertThrows(
                AuthException.class, () -> service.create(tenant, request("super-admin")));

        assertEquals(400, ex.getStatus());
        verify(users, never()).save(any(User.class));
    }

    @Test
    void doesNotDemoteTheLastAdministrator() {
        Tenant tenant = tenant("starter");
        User admin = user(tenant, Role.ADMIN_ENTREPRISE);
        when(users.findByIdAndTenantId(admin.getId(), tenant.getId())).thenReturn(Optional.of(admin));
        when(users.countByTenantIdAndRole(tenant.getId(), Role.ADMIN_ENTREPRISE)).thenReturn(1L);

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.update(
                        tenant,
                        admin.getId(),
                        new UpdateTeamMemberRequest("commercial", null, null)));

        assertEquals(409, ex.getStatus());
        verify(users, never()).save(any(User.class));
    }

    @Test
    void doesNotFindAUserFromAnotherTenant() {
        Tenant tenant = tenant("starter");
        UUID userId = UUID.randomUUID();
        when(users.findByIdAndTenantId(userId, tenant.getId())).thenReturn(Optional.empty());

        AuthException ex = assertThrows(
                AuthException.class,
                () -> service.update(
                        tenant,
                        userId,
                        new UpdateTeamMemberRequest(null, false, null)));

        assertEquals(404, ex.getStatus());
    }

    private CreateTeamMemberRequest request(String role) {
        return new CreateTeamMemberRequest("Ada", "ada@example.com", role, "secret123", false);
    }

    private Tenant tenant(String planId) {
        Tenant tenant = new Tenant();
        tenant.setId(UUID.randomUUID());
        tenant.setPlanId(planId);
        return tenant;
    }

    private User user(Tenant tenant, Role role) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setTenant(tenant);
        user.setFullName("Ada Lovelace");
        user.setEmail("ada@example.com");
        user.setRole(role);
        return user;
    }
}

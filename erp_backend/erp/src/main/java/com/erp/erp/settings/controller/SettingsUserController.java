package com.erp.erp.settings.controller;

import com.erp.erp.settings.dto.CreateTeamMemberRequest;
import com.erp.erp.settings.dto.TeamMemberResponse;
import com.erp.erp.settings.dto.UpdateTeamMemberRequest;
import com.erp.erp.settings.service.SettingsAccess;
import com.erp.erp.settings.service.SettingsUserService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings/users")
public class SettingsUserController {

    private final SettingsUserService userService;
    private final SettingsAccess access;

    public SettingsUserController(SettingsUserService userService, SettingsAccess access) {
        this.userService = userService;
        this.access = access;
    }

    @GetMapping
    public List<TeamMemberResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return userService.list(access.requireAdmin(jwt));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TeamMemberResponse create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateTeamMemberRequest request) {
        return userService.create(access.requireAdmin(jwt), request);
    }

    @PatchMapping("/{userId}")
    public TeamMemberResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID userId,
            @RequestBody UpdateTeamMemberRequest request) {
        return userService.update(access.requireAdmin(jwt), userId, request);
    }

    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID userId) {
        userService.delete(access.requireAdmin(jwt), userId);
    }
}

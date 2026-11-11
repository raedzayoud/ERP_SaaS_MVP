package com.erp.erp.activity.controller;

import com.erp.erp.activity.dto.ActivityResponse;
import com.erp.erp.activity.service.ActivityService;
import com.erp.erp.settings.service.SettingsAccess;
import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/settings/activity")
public class ActivityController {

    private final ActivityService activityService;
    private final SettingsAccess access;

    public ActivityController(ActivityService activityService, SettingsAccess access) {
        this.activityService = activityService;
        this.access = access;
    }

    @GetMapping
    public List<ActivityResponse> recent(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(defaultValue = "8") int limit) {
        return activityService.recent(access.requireAdmin(jwt).getId(), limit);
    }
}

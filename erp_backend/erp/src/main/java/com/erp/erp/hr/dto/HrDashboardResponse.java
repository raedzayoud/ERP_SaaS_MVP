package com.erp.erp.hr.dto;

/** The figures shown on the HR dashboard. */
public record HrDashboardResponse(
        long totalEmployees, long onLeave, long pendingLeave, long roles) {}

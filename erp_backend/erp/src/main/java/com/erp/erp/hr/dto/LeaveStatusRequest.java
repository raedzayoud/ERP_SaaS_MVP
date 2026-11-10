package com.erp.erp.hr.dto;

import jakarta.validation.constraints.NotBlank;

public record LeaveStatusRequest(@NotBlank String status) {}

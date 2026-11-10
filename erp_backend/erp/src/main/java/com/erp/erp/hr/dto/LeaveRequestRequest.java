package com.erp.erp.hr.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public record LeaveRequestRequest(
        @NotNull UUID employeeId,
        @NotBlank String type,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        String reason) {}

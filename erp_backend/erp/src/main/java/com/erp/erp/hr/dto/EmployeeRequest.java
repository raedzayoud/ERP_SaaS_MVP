package com.erp.erp.hr.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record EmployeeRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        String phone,
        @NotBlank String role,
        String position,
        @NotNull LocalDate hireDate,
        String status,
        // Mandatory on creation: a login account is always created.
        String password) {}

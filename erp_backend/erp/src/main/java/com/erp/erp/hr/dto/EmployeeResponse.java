package com.erp.erp.hr.dto;

import com.erp.erp.hr.model.Employee;
import java.util.Locale;
import java.util.UUID;

public record EmployeeResponse(
        UUID id,
        String fullName,
        String email,
        String phone,
        String department,
        String position,
        String hireDate,
        String status,
        String createdAt) {

    public static EmployeeResponse from(Employee employee) {
        return new EmployeeResponse(
                employee.getId(),
                employee.getFullName(),
                employee.getEmail(),
                employee.getPhone(),
                employee.getDepartment(),
                employee.getPosition(),
                employee.getHireDate() == null ? null : employee.getHireDate().toString(),
                employee.getStatus() == null
                        ? null
                        : employee.getStatus().name().toLowerCase(Locale.ROOT),
                employee.getCreatedAt() == null ? null : employee.getCreatedAt().toString());
    }
}

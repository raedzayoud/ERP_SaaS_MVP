package com.erp.erp.hr.dto;

import com.erp.erp.hr.model.LeaveRequest;
import java.util.Locale;
import java.util.UUID;

public record LeaveRequestResponse(
        UUID id,
        UUID employeeId,
        String employeeName,
        String type,
        String startDate,
        String endDate,
        String reason,
        String status,
        String createdAt) {

    public static LeaveRequestResponse from(LeaveRequest request) {
        return new LeaveRequestResponse(
                request.getId(),
                request.getEmployee().getId(),
                request.getEmployee().getFullName(),
                request.getType() == null
                        ? null
                        : request.getType().name().toLowerCase(Locale.ROOT),
                request.getStartDate() == null ? null : request.getStartDate().toString(),
                request.getEndDate() == null ? null : request.getEndDate().toString(),
                request.getReason(),
                request.getStatus() == null
                        ? null
                        : request.getStatus().name().toLowerCase(Locale.ROOT),
                request.getCreatedAt() == null ? null : request.getCreatedAt().toString());
    }
}

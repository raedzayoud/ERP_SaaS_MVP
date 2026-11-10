package com.erp.erp.support.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record SupportTicketRequest(
        @NotBlank String subject,
        @NotBlank String description,
        @NotBlank String requesterName,
        @NotBlank @Email String requesterEmail,
        String type,
        String priority,
        String status,
        String assignee) {}

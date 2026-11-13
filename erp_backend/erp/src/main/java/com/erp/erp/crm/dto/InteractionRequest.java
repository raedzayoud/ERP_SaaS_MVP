package com.erp.erp.crm.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record InteractionRequest(
        @NotBlank String type,
        LocalDate date,
        @NotBlank String subject,
        String notes,
        LocalDate reminderAt) {}

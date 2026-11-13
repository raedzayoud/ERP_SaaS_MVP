package com.erp.erp.crm.dto;

import jakarta.validation.constraints.NotBlank;

public record OpportunityStageRequest(@NotBlank String stage) {}

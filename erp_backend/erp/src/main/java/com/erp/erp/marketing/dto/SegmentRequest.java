package com.erp.erp.marketing.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public record SegmentRequest(
        @NotBlank String name,
        String description,
        List<String> customerIds) {}

package com.erp.erp.marketing.dto;

import java.util.List;
import java.util.UUID;

public record SegmentResponse(
        UUID id,
        String name,
        String description,
        List<String> customerIds,
        int memberCount,
        String createdAt,
        String updatedAt) {}

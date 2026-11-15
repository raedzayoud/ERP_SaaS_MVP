package com.erp.erp.settings.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record AddModulesRequest(@NotEmpty List<String> modules) {}

package com.erp.erp.settings.dto;

import java.util.List;

/** The module catalog of the workspace and the modules it already has. */
public record ModuleCatalogResponse(
        String plan, List<String> enabledModules, List<ModuleOfferResponse> offers) {}

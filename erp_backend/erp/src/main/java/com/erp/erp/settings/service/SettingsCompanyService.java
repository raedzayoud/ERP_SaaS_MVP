package com.erp.erp.settings.service;

import com.erp.erp.auth.dto.TenantResponse;
import com.erp.erp.settings.dto.CompanySettingsRequest;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.repository.TenantRepository;
import java.util.Locale;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads and updates the editable company profile of a tenant. */
@Service
public class SettingsCompanyService {

    private final TenantRepository tenantRepository;

    public SettingsCompanyService(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @Transactional(readOnly = true)
    public TenantResponse get(Tenant tenant) {
        return TenantResponse.from(tenant);
    }

    @Transactional
    public TenantResponse update(Tenant tenant, CompanySettingsRequest request) {
        tenant.setCompanyName(request.companyName().trim());
        tenant.setCurrency(request.currency().trim().toUpperCase(Locale.ROOT));
        tenant.setAddress(trimToNull(request.address()));
        tenant.setCountry(request.country().trim());
        tenant.setLanguage(request.language().trim().toLowerCase(Locale.ROOT));
        tenant.setCompanySize(request.companySize().trim());

        return TenantResponse.from(tenantRepository.save(tenant));
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}

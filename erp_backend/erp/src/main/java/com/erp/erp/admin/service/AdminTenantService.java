package com.erp.erp.admin.service;

import com.erp.erp.admin.dto.AdminTenantResponse;
import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.tenant.model.KycStatus;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.tenant.model.TenantStatus;
import com.erp.erp.tenant.repository.TenantRepository;
import com.erp.erp.user.repository.UserRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Read and update the tenants shown in the super-admin console. */
@Service
public class AdminTenantService {

    private final TenantRepository tenantRepository;
    private final UserRepository userRepository;

    public AdminTenantService(
            TenantRepository tenantRepository, UserRepository userRepository) {
        this.tenantRepository = tenantRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<AdminTenantResponse> list() {
        return tenantRepository.findByKycStatusNotOrderByCreatedAtDesc(KycStatus.REJECTED).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AdminTenantResponse> recent() {
        return tenantRepository.findTop5ByKycStatusNotOrderByCreatedAtDesc(KycStatus.REJECTED)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AdminTenantResponse updateStatus(UUID tenantId, String statusValue) {
        TenantStatus status = parseStatus(statusValue);
        Tenant tenant = tenantRepository
                .findById(tenantId)
                .orElseThrow(() -> new AuthException(404, "tenant not found"));

        tenant.setTenantStatus(status);
        return toResponse(tenant);
    }

    private TenantStatus parseStatus(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!"ACTIVE".equals(normalized) && !"SUSPENDED".equals(normalized)) {
            throw new AuthException(400, "status must be ACTIVE or SUSPENDED");
        }
        return TenantStatus.valueOf(normalized);
    }

    private AdminTenantResponse toResponse(Tenant tenant) {
        long usersCount = userRepository.countByTenantId(tenant.getId());
        return AdminTenantResponse.from(tenant, usersCount);
    }
}

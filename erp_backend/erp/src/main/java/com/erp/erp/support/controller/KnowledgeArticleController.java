package com.erp.erp.support.controller;

import com.erp.erp.common.security.CurrentTenantService;
import com.erp.erp.support.dto.KnowledgeArticleRequest;
import com.erp.erp.support.dto.KnowledgeArticleResponse;
import com.erp.erp.support.service.KnowledgeArticleService;
import com.erp.erp.tenant.model.Tenant;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/support/articles")
public class KnowledgeArticleController {

    private final KnowledgeArticleService service;
    private final CurrentTenantService currentTenant;

    public KnowledgeArticleController(
            KnowledgeArticleService service, CurrentTenantService currentTenant) {
        this.service = service;
        this.currentTenant = currentTenant;
    }

    @GetMapping
    public List<KnowledgeArticleResponse> list(@AuthenticationPrincipal Jwt jwt) {
        return service.list(tenant(jwt));
    }

    @PostMapping
    public ResponseEntity<KnowledgeArticleResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody KnowledgeArticleRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(tenant(jwt), request));
    }

    @PutMapping("/{id}")
    public KnowledgeArticleResponse update(
            @AuthenticationPrincipal Jwt jwt,
            @PathVariable UUID id,
            @Valid @RequestBody KnowledgeArticleRequest request) {
        return service.update(tenant(jwt), id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        service.delete(tenant(jwt), id);
        return ResponseEntity.noContent().build();
    }

    private Tenant tenant(Jwt jwt) {
        Tenant tenant = currentTenant.require(jwt);
        currentTenant.requireModule(jwt, tenant, "support");
        return tenant;
    }
}

package com.erp.erp.marketing.service;

import com.erp.erp.auth.exception.AuthException;
import com.erp.erp.marketing.dto.SegmentRequest;
import com.erp.erp.marketing.dto.SegmentResponse;
import com.erp.erp.marketing.model.CustomerSegment;
import com.erp.erp.marketing.model.SegmentMember;
import com.erp.erp.marketing.repository.CustomerSegmentRepository;
import com.erp.erp.marketing.repository.MarketingPromotionRepository;
import com.erp.erp.marketing.repository.SegmentMemberRepository;
import com.erp.erp.tenant.model.Tenant;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CustomerSegmentService {

    private final CustomerSegmentRepository segments;
    private final SegmentMemberRepository members;
    private final MarketingPromotionRepository promotions;

    public CustomerSegmentService(
            CustomerSegmentRepository segments,
            SegmentMemberRepository members,
            MarketingPromotionRepository promotions) {
        this.segments = segments;
        this.members = members;
        this.promotions = promotions;
    }

    @Transactional(readOnly = true)
    public List<SegmentResponse> list(Tenant tenant, String search) {
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Map<UUID, List<String>> memberIds = members
                .findByTenantIdOrderByCustomerRefAsc(tenant.getId())
                .stream()
                .collect(Collectors.groupingBy(
                        member -> member.getSegment().getId(),
                        LinkedHashMap::new,
                        Collectors.mapping(SegmentMember::getCustomerRef, Collectors.toList())));

        return segments.findByTenantIdOrderByCreatedAtDesc(tenant.getId()).stream()
                .filter(segment -> query.isEmpty() || matches(segment, query))
                .map(segment -> response(
                        segment, memberIds.getOrDefault(segment.getId(), List.of())))
                .toList();
    }

    @Transactional(readOnly = true)
    public SegmentResponse get(Tenant tenant, UUID id) {
        CustomerSegment segment = find(tenant, id);
        return response(segment, customerIds(tenant, id));
    }

    @Transactional
    public SegmentResponse create(Tenant tenant, SegmentRequest request) {
        CustomerSegment segment = new CustomerSegment();
        segment.setTenant(tenant);
        apply(segment, request);

        CustomerSegment saved = segments.save(segment);
        replaceMembers(tenant, saved, request.customerIds());
        return response(saved, customerIds(tenant, saved.getId()));
    }

    @Transactional
    public SegmentResponse update(Tenant tenant, UUID id, SegmentRequest request) {
        CustomerSegment segment = find(tenant, id);
        apply(segment, request);
        segment.setUpdatedAt(Instant.now());
        segments.save(segment);

        replaceMembers(tenant, segment, request.customerIds());
        return response(segment, customerIds(tenant, id));
    }

    @Transactional
    public void delete(Tenant tenant, UUID id) {
        CustomerSegment segment = find(tenant, id);
        if (promotions.existsBySegmentIdAndTenantId(id, tenant.getId())) {
            throw new AuthException(409, "segment is used by a promotion");
        }
        members.deleteByTenantIdAndSegmentId(tenant.getId(), id);
        segments.delete(segment);
    }

    private CustomerSegment find(Tenant tenant, UUID id) {
        return segments
                .findByIdAndTenantId(id, tenant.getId())
                .orElseThrow(() -> new AuthException(404, "segment not found"));
    }

    private void apply(CustomerSegment segment, SegmentRequest request) {
        segment.setName(request.name().trim());
        segment.setDescription(request.description());
    }

    private void replaceMembers(
            Tenant tenant, CustomerSegment segment, List<String> customerIds) {
        members.deleteByTenantIdAndSegmentId(tenant.getId(), segment.getId());
        members.flush();

        for (String customerId : normalize(customerIds)) {
            SegmentMember member = new SegmentMember();
            member.setTenant(tenant);
            member.setSegment(segment);
            member.setCustomerRef(customerId);
            members.save(member);
        }
    }

    private List<String> customerIds(Tenant tenant, UUID segmentId) {
        return members.findByTenantIdAndSegmentIdOrderByCustomerRefAsc(tenant.getId(), segmentId)
                .stream()
                .map(SegmentMember::getCustomerRef)
                .toList();
    }

    private Set<String> normalize(List<String> customerIds) {
        Set<String> normalized = new LinkedHashSet<>();
        if (customerIds == null) {
            return normalized;
        }
        for (String customerId : customerIds) {
            if (customerId == null || customerId.isBlank()) {
                continue;
            }
            normalized.add(customerId.trim());
        }
        return normalized;
    }

    private SegmentResponse response(CustomerSegment segment, List<String> customerIds) {
        return new SegmentResponse(
                segment.getId(),
                segment.getName(),
                segment.getDescription(),
                customerIds,
                customerIds.size(),
                segment.getCreatedAt() == null ? null : segment.getCreatedAt().toString(),
                segment.getUpdatedAt() == null ? null : segment.getUpdatedAt().toString());
    }

    private boolean matches(CustomerSegment segment, String query) {
        return contains(segment.getName(), query) || contains(segment.getDescription(), query);
    }

    private boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }
}

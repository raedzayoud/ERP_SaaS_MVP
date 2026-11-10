package com.erp.erp.marketing.repository;

import com.erp.erp.marketing.model.SegmentMember;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SegmentMemberRepository extends JpaRepository<SegmentMember, UUID> {

    List<SegmentMember> findByTenantIdOrderByCustomerRefAsc(UUID tenantId);

    List<SegmentMember> findByTenantIdAndSegmentIdOrderByCustomerRefAsc(
            UUID tenantId, UUID segmentId);

    List<SegmentMember> findByTenantIdAndCustomerRef(UUID tenantId, String customerRef);

    void deleteByTenantIdAndSegmentId(UUID tenantId, UUID segmentId);
}

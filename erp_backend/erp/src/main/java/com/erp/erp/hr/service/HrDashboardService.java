package com.erp.erp.hr.service;

import com.erp.erp.hr.dto.HrDashboardResponse;
import com.erp.erp.hr.model.EmployeeStatus;
import com.erp.erp.hr.model.LeaveStatus;
import com.erp.erp.hr.repository.EmployeeRepository;
import com.erp.erp.hr.repository.LeaveRequestRepository;
import com.erp.erp.tenant.model.Tenant;
import com.erp.erp.user.model.Role;
import java.util.HashSet;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Counts of the HR dashboard. */
@Service
public class HrDashboardService {

    private final EmployeeRepository employees;
    private final LeaveRequestRepository leaveRequests;

    public HrDashboardService(
            EmployeeRepository employees, LeaveRequestRepository leaveRequests) {
        this.employees = employees;
        this.leaveRequests = leaveRequests;
    }

    /**
     * shortcut: the counters are computed in Java over the tenant rows, like the
     * marketing dashboard; switch to SQL count queries for a tenant with
     * thousands of employees.
     */
    @Transactional(readOnly = true)
    public HrDashboardResponse dashboard(Tenant tenant) {
        var employeesOfTenant = employees.findByTenantIdOrderByFullNameAsc(tenant.getId());
        var leavesOfTenant = leaveRequests.findByTenantIdOrderByCreatedAtDesc(tenant.getId());

        Set<Role> roles = new HashSet<>();
        long onLeave = 0;
        for (var employee : employeesOfTenant) {
            roles.add(employee.getRole());
            if (employee.getStatus() == EmployeeStatus.ON_LEAVE) {
                onLeave++;
            }
        }

        long pendingLeave =
                leavesOfTenant.stream()
                        .filter(leave -> leave.getStatus() == LeaveStatus.PENDING)
                        .count();

        return new HrDashboardResponse(employeesOfTenant.size(), onLeave, pendingLeave, roles.size());
    }
}

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { HrApiService } from '../../services/hr-api.service';
import { Employee } from '../../models/employee';
import { LeaveRequest } from '../../models/leave-request';

@Component({
  selector: 'app-hr-dashboard',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './hr-dashboard.html',
  styleUrl: './hr-dashboard.css',
})
export class HrDashboard {
  private readonly api = inject(HrApiService);

  employees = signal<Employee[]>([]);
  leaveRequests = signal<LeaveRequest[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  totalEmployees = computed(() => this.employees().length);
  onLeave = computed(
    () => this.employees().filter((employee) => employee.status === 'on_leave').length,
  );
  pendingLeave = computed(
    () => this.leaveRequests().filter((request) => request.status === 'pending').length,
  );
  departments = computed(
    () => new Set(this.employees().map((employee) => employee.department)).size,
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getEmployees().subscribe({
      next: (employees) => this.employees.set(employees),
      error: () => this.loadFailed.set(true),
    });

    this.api.getLeaveRequests().subscribe({
      next: (requests) => {
        this.leaveRequests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }
}

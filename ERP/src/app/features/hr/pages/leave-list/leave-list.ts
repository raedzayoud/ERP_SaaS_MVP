import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { PermissionService } from '../../../../core/services/permission.service';
import { Employee } from '../../models/employee';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../models/leave-request';
import { HrApiService } from '../../services/hr-api.service';

@Component({
  selector: 'app-leave-list',
  imports: [ReactiveFormsModule, TranslocoDirective],
  templateUrl: './leave-list.html',
  styleUrl: './leave-list.css',
})
export class LeaveList {
  private readonly api = inject(HrApiService);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  readonly permissions = inject(PermissionService);

  leaveRequests = signal<LeaveRequest[]>([]);
  employees = signal<Employee[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);
  notice = signal('');

  form = this.fb.nonNullable.group({
    employeeId: ['', Validators.required],
    type: ['annual' as LeaveType, Validators.required],
    startDate: [new Date().toISOString().slice(0, 10), Validators.required],
    endDate: [new Date().toISOString().slice(0, 10), Validators.required],
    reason: [''],
  });

  constructor() {
    this.loadEmployees();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
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

  loadEmployees(): void {
    this.api.getEmployees().subscribe({
      next: (employees) => this.employees.set(employees),
    });
  }

  create(): void {
    this.submitted.set(true);
    this.submitFailed.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    if (value.endDate < value.startDate) {
      this.submitFailed.set(true);
      return;
    }

    this.saving.set(true);
    this.api.createLeaveRequest(value).subscribe({
      next: () => {
        this.notice.set('hr.leave.created');
        this.saving.set(false);
        this.submitted.set(false);
        this.form.reset({
          employeeId: '',
          type: 'annual',
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date().toISOString().slice(0, 10),
          reason: '',
        });
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  updateStatus(request: LeaveRequest, status: LeaveStatus): void {
    this.api.updateLeaveStatus(request.id, status).subscribe({
      next: () => {
        this.notice.set('hr.leave.updated');
        this.load();
      },
    });
  }

  delete(request: LeaveRequest): void {
    if (!window.confirm(this.transloco.translate('hr.leave.delete'))) {
      return;
    }

    this.api.deleteLeaveRequest(request.id).subscribe({
      next: () => {
        this.notice.set('hr.leave.deleted');
        this.load();
      },
    });
  }

  statusClass(status: string): string {
    if (status === 'approved') return 'badge badge-success';
    if (status === 'rejected') return 'badge badge-danger';
    return 'badge badge-warning';
  }

  isInvalid(field: 'employeeId' | 'startDate' | 'endDate'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }
}

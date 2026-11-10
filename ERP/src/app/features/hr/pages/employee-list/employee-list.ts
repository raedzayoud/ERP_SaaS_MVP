import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { Employee } from '../../models/employee';
import { HrApiService } from '../../services/hr-api.service';

@Component({
  selector: 'app-employee-list',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './employee-list.html',
  styleUrl: './employee-list.css',
})
export class EmployeeList {
  private readonly api = inject(HrApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  employees = signal<Employee[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');
  search = signal('');
  searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.load();
      });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getEmployees(this.search() || undefined).subscribe({
      next: (employees) => {
        this.employees.set(employees);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  delete(employee: Employee): void {
    if (!window.confirm(this.transloco.translate('hr.employees.deleteConfirm'))) {
      return;
    }

    this.api.deleteEmployee(employee.id).subscribe({
      next: () => {
        this.notice.set('hr.employees.deleted');
        this.load();
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          this.notice.set('hr.employees.deleteBlocked');
        } else {
          this.notice.set('hr.employees.loadError');
        }
      },
    });
  }

  statusClass(status: string): string {
    if (status === 'active') return 'badge badge-success';
    if (status === 'on_leave') return 'badge badge-warning';
    return 'badge badge-danger';
  }
}

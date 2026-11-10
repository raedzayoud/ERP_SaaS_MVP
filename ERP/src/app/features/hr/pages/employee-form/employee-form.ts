import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { EmployeeInput, EmployeeStatus } from '../../models/employee';
import { HrApiService } from '../../services/hr-api.service';

type CheckedField = 'fullName' | 'email' | 'department' | 'position' | 'hireDate';

@Component({
  selector: 'app-employee-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './employee-form.html',
  styleUrl: './employee-form.css',
})
export class EmployeeForm {
  private readonly api = inject(HrApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  readonly employeeId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.employeeId !== null;

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    department: ['', Validators.required],
    position: ['', Validators.required],
    hireDate: [new Date().toISOString().slice(0, 10), Validators.required],
    status: ['active' as EmployeeStatus, Validators.required],
  });

  constructor() {
    if (this.employeeId) {
      this.load(this.employeeId);
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.api.getEmployee(id).subscribe({
      next: (employee) => {
        this.form.patchValue(employee);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  isInvalid(field: CheckedField): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(field: CheckedField, error: string): boolean {
    return this.isInvalid(field) && this.form.controls[field].hasError(error);
  }

  submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.submitFailed.set(false);
    const input = this.form.getRawValue() as EmployeeInput;
    const request = this.employeeId
      ? this.api.updateEmployee(this.employeeId, input)
      : this.api.createEmployee(input);

    request.subscribe({
      next: () => void this.router.navigate(['/hr/employees']),
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }
}

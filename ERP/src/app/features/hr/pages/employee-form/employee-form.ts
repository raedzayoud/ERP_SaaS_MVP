import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { apiErrorCode } from '../../../../core/services/api-error';
import { Role } from '../../../../core/models/role';
import { EmployeeInput, EmployeeStatus, EMPLOYEE_ROLES } from '../../models/employee';
import { HrApiService } from '../../services/hr-api.service';

type CheckedField = 'fullName' | 'email' | 'role' | 'hireDate';

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

  /** Kept out of the form: existing values are preserved on update. */
  private position = '';

  readonly employeeId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.employeeId !== null;
  readonly employeeRoles = EMPLOYEE_ROLES;

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  errorKey = signal('');
  submitted = signal(false);

  form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    role: ['commercial' as Role, Validators.required],
    hireDate: [new Date().toISOString().slice(0, 10), Validators.required],
    status: ['active' as EmployeeStatus, Validators.required],
    password: [''],
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
        this.position = employee.position ?? '';
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

  /** The login password is mandatory on creation: at least 8 characters. */
  passwordTooShort(): boolean {
    return !this.isEdit && this.form.getRawValue().password.length < 8 && this.submitted();
  }

  submit(): void {
    this.submitted.set(true);
    const raw = this.form.getRawValue();

    if (this.form.invalid || (!this.isEdit && raw.password.length < 8)) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.errorKey.set('');
    const input: EmployeeInput = {
      fullName: raw.fullName,
      email: raw.email,
      phone: raw.phone,
      role: raw.role,
      position: this.position,
      hireDate: raw.hireDate,
      status: raw.status,
      ...(this.isEdit ? {} : { password: raw.password }),
    };
    const request = this.employeeId
      ? this.api.updateEmployee(this.employeeId, input)
      : this.api.createEmployee(input);

    request.subscribe({
      next: () => void this.router.navigate(['/hr/employees']),
      error: (error: unknown) => {
        this.saving.set(false);
        const code = apiErrorCode(error);
        if (code === 'notFound') {
          this.errorKey.set('hr.form.notFound');
        } else if (code === 'invalidRole') {
          this.errorKey.set('hr.form.invalidRole');
        } else if (code === 'emailTaken') {
          this.errorKey.set('hr.form.emailTaken');
        } else if (code === 'planUserLimit') {
          this.errorKey.set('hr.form.planUserLimit');
        } else if (code === 'invalidPassword') {
          this.errorKey.set('hr.form.passwordTooShort');
        } else {
          this.errorKey.set('hr.form.saveError');
        }
      },
    });
  }
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { EmployeeForm } from './employee-form';
import { HrApiService } from '../../services/hr-api.service';

const EN = {
  hr: {
    form: {
      newTitle: 'New employee',
      editTitle: 'Edit employee',
      newSubtitle: 'Add an employee.',
      editSubtitle: 'Update this employee.',
      notFound: 'Employee not found',
      notFoundHint: 'It may have been deleted.',
      saveError: 'The employee could not be saved.',
      fullName: 'Full name',
      email: 'Email',
      phone: 'Phone',
      role: 'Role',
      hireDate: 'Hire date',
      status: 'Status',
      required: 'This field is required.',
      invalidEmail: 'Enter a valid email address.',
      invalidRole: 'Choose one of the roles of the company.',
      password: 'Password',
      passwordHint: 'At least 8 characters.',
      passwordTooShort: 'The password must contain at least 8 characters.',
      emailTaken: 'This email already has a login account.',
      planUserLimit: "Your plan's user limit is reached.",
      save: 'Save employee',
    },
  },
  roles: {
    commercial: { label: 'Commercial' },
    acheteur: { label: 'Buyer' },
  },
  common: { back: 'Back', cancel: 'Cancel', saving: 'Saving…' },
};

describe('EmployeeForm', () => {
  let createEmployee: ReturnType<typeof vi.fn>;
  let updateEmployee: ReturnType<typeof vi.fn>;

  function setup(id: string | null): ComponentFixture<EmployeeForm> {
    createEmployee = vi.fn().mockReturnValue(of({}));
    updateEmployee = vi.fn().mockReturnValue(of({}));

    TestBed.configureTestingModule({
      imports: [
        EmployeeForm,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
        {
          provide: HrApiService,
          useValue: {
            getEmployee: () =>
              of({
                id: 'e1',
                fullName: 'Ada Lovelace',
                email: 'ada@example.com',
                phone: '',
                role: 'commercial',
                position: 'Developer',
                hireDate: '2026-01-01',
                status: 'active',
                createdAt: '2026-01-01T10:00:00.000Z',
                hasAccount: false,
              }),
            createEmployee,
            updateEmployee,
          },
        },
      ],
    });

    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return TestBed.createComponent(EmployeeForm);
  }

  function fill(fixture: ComponentFixture<EmployeeForm>): void {
    fixture.componentInstance.form.patchValue({
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      hireDate: '2026-01-01',
    });
  }

  it('sends the password when creating an employee', () => {
    const fixture = setup(null);
    fill(fixture);
    fixture.componentInstance.form.patchValue({ password: 'secret123' });

    fixture.componentInstance.submit();

    expect(createEmployee).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ada@example.com', password: 'secret123' }),
    );
  });

  it('blocks a creation without password', () => {
    const fixture = setup(null);
    fill(fixture);

    fixture.componentInstance.submit();

    expect(createEmployee).not.toHaveBeenCalled();
    expect(fixture.componentInstance.passwordTooShort()).toBe(true);
  });

  it('blocks a short password', () => {
    const fixture = setup(null);
    fill(fixture);
    fixture.componentInstance.form.patchValue({ password: 'short' });

    fixture.componentInstance.submit();

    expect(createEmployee).not.toHaveBeenCalled();
    expect(fixture.componentInstance.passwordTooShort()).toBe(true);
  });

  it('never sends a password when editing', () => {
    const fixture = setup('e1');
    fixture.componentInstance.form.patchValue({ password: 'secret123' });

    fixture.componentInstance.submit();

    const input = updateEmployee.mock.calls[0][1] as Record<string, unknown>;
    expect(input).not.toHaveProperty('password');
  });
});

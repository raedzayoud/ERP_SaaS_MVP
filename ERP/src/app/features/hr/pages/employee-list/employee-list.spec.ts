import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { EmployeeList } from './employee-list';
import { HrApiService } from '../../services/hr-api.service';
import { Employee } from '../../models/employee';
import { AuthService } from '../../../../core/services/auth.service';

const EN = {
  hr: {
    employees: {
      title: 'Employees',
      subtitle: 'Your staff directory.',
      newEmployee: 'New employee',
      searchPlaceholder: 'Search employees…',
      loadError: 'Employees could not be loaded',
      loadErrorHint: 'Please try again.',
      emptyTitle: 'No employees yet',
      emptyHint: 'Add your first employee.',
      noMatch: 'No employees match your search',
      noMatchHint: 'Try another keyword.',
      deleteConfirm: 'Delete this employee?',
      deleteBlocked: 'This employee has leave requests and cannot be deleted.',
      deleted: 'Employee deleted',
      columns: {
        name: 'Name',
        email: 'Email',
        department: 'Department',
        position: 'Position',
        status: 'Status',
        actions: 'Actions',
      },
      status: { active: 'Active', on_leave: 'On leave', inactive: 'Inactive' },
    },
  },
  common: { loading: 'Loading…', retry: 'Retry', edit: 'Edit', delete: 'Delete' },
};

const ADA: Employee = {
  id: 'e1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  department: 'Engineering',
  position: 'Developer',
  hireDate: '2026-01-01',
  status: 'active',
  createdAt: '2026-01-01T10:00:00.000Z',
};

describe('EmployeeList', () => {
  function setup(deleteError: unknown | null): ComponentFixture<EmployeeList> {
    TestBed.configureTestingModule({
      imports: [
        EmployeeList,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        {
          provide: HrApiService,
          useValue: {
            getEmployees: () => of([ADA]),
            getEmployee: () => of(ADA),
            createEmployee: () => of(ADA),
            updateEmployee: () => of(ADA),
            deleteEmployee: (id: string) =>
              deleteError ? throwError(() => deleteError) : of(undefined as void),
          },
        },
      ],
    });

    TestBed.inject(AuthService).refreshUser({
      id: 1,
      name: 'Admin Demo',
      email: 'admin@tenant.com',
      role: 'admin-entreprise',
    });

    return TestBed.createComponent(EmployeeList);
  }

  async function render(fixture: ComponentFixture<EmployeeList>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders one row per employee', async () => {
    const fixture = setup(null);
    await render(fixture);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada Lovelace');
  });

  it('explains that an employee with leave requests cannot be deleted', async () => {
    const fixture = setup(
      new HttpErrorResponse({ status: 409, error: { code: 'employeeHasLeaveRequests' } }),
    );
    await render(fixture);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.componentInstance.delete(ADA);
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('This employee has leave requests and cannot be deleted.');
  });
});

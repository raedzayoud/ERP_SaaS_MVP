import { provideHttpClient } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { LeaveList } from './leave-list';
import { HrApiService } from '../../services/hr-api.service';
import { Employee } from '../../models/employee';
import { LeaveRequest } from '../../models/leave-request';
import { AuthService } from '../../../../core/services/auth.service';

const EN = {
  hr: {
    leave: {
      title: 'Leave requests',
      subtitle: 'Create and review employee leave.',
      loadError: 'Leave requests could not be loaded',
      loadErrorHint: 'Please try again.',
      emptyTitle: 'No leave requests yet',
      emptyHint: 'Create a leave request for an employee.',
      columns: {
        employee: 'Employee',
        type: 'Type',
        period: 'Period',
        status: 'Status',
        actions: 'Actions',
      },
      status: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' },
      types: { annual: 'Annual', sick: 'Sick', unpaid: 'Unpaid', other: 'Other' },
      newRequest: 'New leave request',
      employee: 'Employee',
      type: 'Type',
      startDate: 'Start date',
      endDate: 'End date',
      reason: 'Reason',
      reasonPlaceholder: 'Optional note',
      create: 'Create request',
      approve: 'Approve',
      reject: 'Reject',
      delete: 'Delete',
      updated: 'Leave request updated',
      noEmployees: 'Add an employee before creating a leave request.',
      dateError: 'The end date must be on or after the start date.',
      selectEmployee: 'Select an employee.',
      saveError: 'The leave request could not be created.',
    },
  },
  common: { loading: 'Loading…', retry: 'Retry', saving: 'Saving…' },
};

const ADA: Employee = {
  id: 'e1',
  fullName: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '',
  role: 'commercial',
  position: 'Developer',
  hireDate: '2026-01-01',
  status: 'active',
  createdAt: '2026-01-01T10:00:00.000Z',
};

const LEAVE: LeaveRequest = {
  id: 'l1',
  employeeId: 'e1',
  employeeName: 'Ada Lovelace',
  type: 'annual',
  startDate: '2026-05-10',
  endDate: '2026-05-12',
  reason: '',
  status: 'pending',
  createdAt: '2026-05-01T10:00:00.000Z',
};

describe('LeaveList', () => {
  function setup(updateStatus: (id: string, status: string) => unknown): ComponentFixture<LeaveList> {
    TestBed.configureTestingModule({
      imports: [
        LeaveList,
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
            getLeaveRequests: () => of([LEAVE]),
            createLeaveRequest: () => of(LEAVE),
            updateLeaveStatus: (id: string, status: string) => {
              updateStatus(id, status);
              return of(LEAVE);
            },
            deleteLeaveRequest: () => of(undefined),
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

    return TestBed.createComponent(LeaveList);
  }

  async function render(fixture: ComponentFixture<LeaveList>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders one row per leave request', async () => {
    const fixture = setup(() => undefined);
    await render(fixture);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ada Lovelace');
  });

  it('approves a pending leave request', async () => {
    const calls: string[] = [];
    const fixture = setup((id, status) => calls.push(`${id}:${status}`));
    await render(fixture);

    fixture.componentInstance.updateStatus(LEAVE, 'approved');
    await fixture.whenStable();

    expect(calls).toEqual(['l1:approved']);
  });

  it('refuses a leave request whose end date is before the start date', async () => {
    const fixture = setup(() => undefined);
    await render(fixture);

    const form = fixture.componentInstance.form;
    form.setValue({
      employeeId: 'e1',
      type: 'annual',
      startDate: '2026-05-12',
      endDate: '2026-05-10',
      reason: '',
    });
    fixture.componentInstance.create();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('The end date must be on or after the start date.');
  });
});

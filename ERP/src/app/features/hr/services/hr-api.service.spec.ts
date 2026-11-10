import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { HrApiService } from './hr-api.service';

describe('HrApiService', () => {
  let api: HrApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(HrApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads employees with search and status filters', () => {
    api.getEmployees('ada', 'active').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/hr/employees?search=ada&status=active`,
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('creates an employee', () => {
    const input = {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
      phone: '',
      department: 'Engineering',
      position: 'Developer',
      hireDate: '2026-01-01',
      status: 'active' as const,
    };

    api.createEmployee(input).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/hr/employees`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({});
  });

  it('updates a leave request status', () => {
    api.updateLeaveStatus('leave-1', 'approved').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/hr/leave-requests/leave-1/status`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ status: 'approved' });
    request.flush({});
  });

  it('deletes an employee', () => {
    api.deleteEmployee('employee-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/hr/employees/employee-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});

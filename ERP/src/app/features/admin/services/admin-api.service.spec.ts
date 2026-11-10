import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { AdminApiService } from './admin-api.service';

describe('AdminApiService', () => {
  let api: AdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the platform statistics', () => {
    api.getStats().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/stats`);
    expect(request.request.method).toBe('GET');
    request.flush({
      totalTenants: 4,
      activeTenants: 2,
      trialTenants: 1,
      suspendedTenants: 1,
      totalUsers: 12,
      monthlyRevenue: 237,
      pendingSignups: 2,
      overdueAmount: 79,
    });
  });

  it('loads every tenant', () => {
    api.getTenants().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/tenants`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('suspends a tenant with the backend enum value', () => {
    api.updateTenantStatus('tenant-1', 'suspended').subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/admin/tenants/tenant-1/status`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ status: 'SUSPENDED' });
    request.flush({
      id: 'tenant-1',
      companyName: 'Acme',
      subdomain: 'acme',
      email: 'owner@acme.com',
      planId: 'starter',
      status: 'suspended',
      usersCount: 2,
      storageUsedGb: 0.4,
      createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('loads the Stripe subscription payments', () => {
    api.getPayments().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/payments`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('loads the read-only plan catalog', () => {
    api.getPlans().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/plans`);
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});

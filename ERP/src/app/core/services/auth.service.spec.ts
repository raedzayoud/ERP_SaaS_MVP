import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthMeResponse, AuthTokens } from '../models/auth';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { withFreshStorage } from './storage-test-helper';

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown): string =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const ACCESS_TOKEN = makeJwt({
  userId: 'user-1',
  role: 'admin-entreprise',
  permissions: {
    dashboard: ['view', 'create'],
    contacts: ['view'],
  },
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const TOKENS: AuthTokens = {
  accessToken: ACCESS_TOKEN,
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  expiresIn: 900,
};

function meResponse(overrides: Partial<AuthMeResponse> = {}): AuthMeResponse {
  return {
    accessToken: ACCESS_TOKEN,
    tokenType: 'Bearer',
    user: {
      id: 'user-1',
      name: 'Amira Ben Salah',
      email: 'owner@acme-test.com',
      role: 'admin-entreprise',
      mustRenewPassword: false,
    },
    tenant: {
      id: 'tenant-1',
      companyName: 'Acme Test',
      email: 'owner@acme-test.com',
      subdomain: 'acme-test',
      country: 'TN',
      language: 'en',
      companySize: '1-5',
      planId: 'enterprise',
      enabledModules: ['dashboard', 'contacts'],
      currency: 'USD',
      taxId: '',
      address: '',
      createdAt: '2026-01-01T00:00:00Z',
      kycStatus: 'APPROVED',
      billingStatus: 'ACTIVE',
    },
    ...overrides,
  };
}

describe('AuthService', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('signs in and loads the user, tenant and token permissions', () => {
    const auth = TestBed.inject(AuthService);
    let signedInEmail = '';

    auth.login('Owner@Acme-Test.com', 'secret').subscribe((user) => {
      signedInEmail = user.email;
    });

    const login = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(login.request.method).toBe('POST');
    expect(login.request.body).toEqual({
      email: 'owner@acme-test.com',
      password: 'secret',
    });
    login.flush(TOKENS);

    const me = http.expectOne(`${environment.apiUrl}/auth/me`);
    me.flush(meResponse());

    expect(signedInEmail).toBe('owner@acme-test.com');
    expect(auth.currentUser()?.role).toBe('admin-entreprise');
    expect(auth.permissions()['contacts']).toEqual(['view']);
    expect(TestBed.inject(TenantService).currentTenant()?.id).toBe('tenant-1');
    expect(localStorage.getItem('erp_refresh_token')).toBe('refresh-1');
    expect(auth.hasAccountAccess()).toBe(true);
    expect(auth.homeRouteForCurrentUser()).toBe('/dashboard');
  });

  it('keeps trial refresh tokens in session storage and allows the workspace', () => {
    const auth = TestBed.inject(AuthService);

    auth.login('owner@acme-test.com', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(TOKENS);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      meResponse({
        tenant: {
          id: 'tenant-1',
          companyName: 'Acme Test',
          email: 'owner@acme-test.com',
          subdomain: 'acme-test',
          country: 'TN',
          language: 'en',
          companySize: '1-5',
          planId: 'starter',
          enabledModules: ['dashboard'],
          currency: 'USD',
          taxId: '',
          address: '',
          createdAt: '2026-01-01T00:00:00Z',
          tenantStatus: 'TRIAL',
          kycStatus: 'PENDING',
          billingStatus: 'NONE',
          trialLimit: 30,
          trialUsed: 5,
        },
      }),
    );

    expect(sessionStorage.getItem('erp_refresh_token')).toBe('refresh-1');
    expect(localStorage.getItem('erp_refresh_token')).toBeNull();
    expect(auth.hasAccountAccess()).toBe(true);
    expect(auth.homeRouteForCurrentUser()).toBe('/dashboard');
  });

  it('denies workspace access once the trial is exhausted', () => {
    const auth = TestBed.inject(AuthService);

    auth.login('owner@acme-test.com', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(TOKENS);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      meResponse({
        tenant: {
          id: 'tenant-1',
          companyName: 'Acme Test',
          email: 'owner@acme-test.com',
          subdomain: 'acme-test',
          country: 'TN',
          language: 'en',
          companySize: '1-5',
          planId: 'starter',
          enabledModules: ['dashboard'],
          currency: 'USD',
          taxId: '',
          address: '',
          createdAt: '2026-01-01T00:00:00Z',
          tenantStatus: 'TRIAL',
          kycStatus: 'PENDING',
          billingStatus: 'NONE',
          trialLimit: 30,
          trialUsed: 30,
        },
      }),
    );

    expect(auth.hasAccountAccess()).toBe(false);
    expect(auth.homeRouteForCurrentUser()).toBe('/account-status');
  });

  it('restores a trial session from session storage', () => {
    sessionStorage.setItem('erp_refresh_token', 'saved-trial-refresh');
    const auth = TestBed.inject(AuthService);

    auth.initialize().subscribe();

    const refresh = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'saved-trial-refresh' });
    refresh.flush({ ...TOKENS, refreshToken: 'refresh-2' });

    const me = http.expectOne(`${environment.apiUrl}/auth/me`);
    me.flush(
      meResponse({
        tenant: {
          id: 'tenant-1',
          companyName: 'Acme Test',
          email: 'owner@acme-test.com',
          subdomain: 'acme-test',
          country: 'TN',
          language: 'en',
          companySize: '1-5',
          planId: 'starter',
          enabledModules: ['dashboard'],
          currency: 'USD',
          taxId: '',
          address: '',
          createdAt: '2026-01-01T00:00:00Z',
          tenantStatus: 'TRIAL',
          kycStatus: 'PENDING',
          billingStatus: 'NONE',
          trialLimit: 30,
          trialUsed: 6,
        },
      }),
    );

    expect(sessionStorage.getItem('erp_refresh_token')).toBe('refresh-2');
    expect(localStorage.getItem('erp_refresh_token')).toBeNull();
  });

  it('sends a tenant with pending KYC or billing to the account status page', () => {
    const auth = TestBed.inject(AuthService);

    auth.login('owner@acme-test.com', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(TOKENS);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      meResponse({
        tenant: {
          id: 'tenant-1',
          companyName: 'Acme Test',
          email: 'owner@acme-test.com',
          subdomain: 'acme-test',
          country: 'TN',
          language: 'en',
          companySize: '1-5',
          planId: 'starter',
          enabledModules: ['dashboard'],
          currency: 'USD',
          taxId: '',
          address: '',
          createdAt: '2026-01-01T00:00:00Z',
          kycStatus: 'PENDING',
          billingStatus: 'PENDING',
        },
      }),
    );

    expect(auth.hasAccountAccess()).toBe(false);
    expect(auth.homeRouteForCurrentUser()).toBe('/account-status');
  });

  it('denies workspace access to a suspended tenant', () => {
    const auth = TestBed.inject(AuthService);

    auth.login('owner@acme-test.com', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(TOKENS);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      meResponse({
        tenant: {
          id: 'tenant-1',
          companyName: 'Acme Test',
          email: 'owner@acme-test.com',
          subdomain: 'acme-test',
          country: 'TN',
          language: 'en',
          companySize: '1-5',
          planId: 'starter',
          enabledModules: ['dashboard'],
          currency: 'USD',
          taxId: '',
          address: '',
          createdAt: '2026-01-01T00:00:00Z',
          tenantStatus: 'SUSPENDED',
          kycStatus: 'APPROVED',
          billingStatus: 'ACTIVE',
        },
      }),
    );

    expect(auth.hasAccountAccess()).toBe(false);
    expect(auth.homeRouteForCurrentUser()).toBe('/account-status');
  });

  it('restores a session by refreshing the saved token first', () => {
    localStorage.setItem('erp_refresh_token', 'saved-refresh');
    const auth = TestBed.inject(AuthService);

    auth.initialize().subscribe();

    const refresh = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'saved-refresh' });
    refresh.flush({ ...TOKENS, refreshToken: 'refresh-2' });

    const me = http.expectOne(`${environment.apiUrl}/auth/me`);
    me.flush(meResponse());

    expect(auth.currentUser()?.email).toBe('owner@acme-test.com');
    expect(localStorage.getItem('erp_refresh_token')).toBe('refresh-2');
  });

  it('clears the session when the saved refresh token is rejected', () => {
    localStorage.setItem('erp_refresh_token', 'expired-refresh');
    const auth = TestBed.inject(AuthService);

    auth.initialize().subscribe();

    const refresh = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    refresh.flush({ message: 'invalid refresh token' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.currentUser()).toBeNull();
    expect(auth.accessToken()).toBeNull();
    expect(localStorage.getItem('erp_refresh_token')).toBeNull();
  });

  it('clears a tenant that is absent from /auth/me, as for super-admins', () => {
    const tenant = TestBed.inject(TenantService);
    tenant.ensureDemoTenant();
    const auth = TestBed.inject(AuthService);

    auth.login('superadmin@platform.com', 'secret').subscribe();
    http.expectOne(`${environment.apiUrl}/auth/login`).flush(TOKENS);
    http.expectOne(`${environment.apiUrl}/auth/me`).flush(
      meResponse({
        user: {
          id: 'admin-1',
          name: 'Platform Admin',
          email: 'superadmin@platform.com',
          role: 'super-admin',
          mustRenewPassword: false,
        },
        tenant: null,
      }),
    );

    expect(auth.currentUser()?.role).toBe('super-admin');
    expect(tenant.currentTenant()).toBeNull();
  });

  it('revokes the refresh token and clears the local session on logout', () => {
    localStorage.setItem('erp_refresh_token', 'saved-refresh');
    const auth = TestBed.inject(AuthService);
    auth.refreshUser({
      id: 1,
      name: 'Amira',
      email: 'owner@acme-test.com',
      role: 'admin-entreprise',
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    auth.logout();

    const logout = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(logout.request.body).toEqual({ refreshToken: 'saved-refresh' });
    logout.flush(null, { status: 204, statusText: 'No Content' });

    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('erp_refresh_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('keeps the demo renew-password flow working with numeric ids', () => {
    const tenant = TestBed.inject(TenantService);
    tenant.ensureDemoTenant();
    const auth = TestBed.inject(AuthService);
    auth.refreshUser({
      id: 1,
      name: 'Amira',
      email: 'admin@demo.com',
      role: 'admin-entreprise',
      mustRenewPassword: true,
    });

    expect(auth.renewPassword('strong-6')).toBe(true);
    expect(auth.currentUser()?.mustRenewPassword).toBe(false);
    expect(tenant.currentTenant()?.users.find((user) => user.id === 1)?.mustRenewPassword).toBe(
      false,
    );
  });
});

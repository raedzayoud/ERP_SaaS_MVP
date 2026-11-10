import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { withFreshStorage } from '../services/storage-test-helper';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let auth: AuthService;
  let client: HttpClient;
  let http: HttpTestingController;

  beforeEach(() => {
    withFreshStorage();
    localStorage.setItem('erp_refresh_token', 'refresh-1');

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    auth = TestBed.inject(AuthService);
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('adds the bearer token to API requests', () => {
    auth.accessToken.set('access-1');

    client.get('/api/v1/contacts').subscribe();

    const request = http.expectOne('/api/v1/contacts');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-1');
    request.flush({});
  });

  it('does not add the bearer token to public auth requests', () => {
    auth.accessToken.set('access-1');

    client.post(`${environment.apiUrl}/auth/login`, {}).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('refreshes once and retries a request that returns 401', () => {
    auth.accessToken.set('expired-access');
    let response: unknown = null;

    client.get('/api/v1/contacts').subscribe((body) => {
      response = body;
    });

    const first = http.expectOne('/api/v1/contacts');
    expect(first.request.headers.get('Authorization')).toBe('Bearer expired-access');
    first.flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'refresh-1' });
    refresh.flush({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      tokenType: 'Bearer',
      expiresIn: 900,
    });

    const retried = http.expectOne('/api/v1/contacts');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer access-2');
    retried.flush({ ok: true });

    expect(response).toEqual({ ok: true });
  });

  it('clears the session and returns to login when refresh fails', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.accessToken.set('expired-access');
    auth.refreshUser({
      id: 1,
      name: 'Amira',
      email: 'owner@acme-test.com',
      role: 'admin-entreprise',
    });

    let failed = false;
    client.get('/api/v1/contacts').subscribe({ error: () => (failed = true) });

    http
      .expectOne('/api/v1/contacts')
      .flush({ message: 'expired' }, { status: 401, statusText: 'Unauthorized' });

    http
      .expectOne(`${environment.apiUrl}/auth/refresh`)
      .flush({ message: 'invalid' }, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.currentUser()).toBeNull();
    expect(localStorage.getItem('erp_refresh_token')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});

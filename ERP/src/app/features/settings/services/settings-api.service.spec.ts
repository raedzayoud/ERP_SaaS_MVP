import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { CompanySettingsRequest, TeamMember } from '../models/settings';
import { SettingsApiService } from './settings-api.service';

describe('SettingsApiService', () => {
  let api: SettingsApiService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(SettingsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the company profile', () => {
    api.getCompany().subscribe();

    const request = http.expectOne(`${baseUrl}/company`);
    expect(request.request.method).toBe('GET');
    request.flush({ id: 'tenant-1', companyName: 'Acme' });
  });

  it('updates the company profile', () => {
    const body: CompanySettingsRequest = {
      companyName: 'Acme',
      currency: 'EUR',
      address: '1 Main St',
      country: 'FR',
      language: 'fr',
      companySize: '11-50',
    };

    api.updateCompany(body).subscribe();

    const request = http.expectOne(`${baseUrl}/company`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ id: 'tenant-1', companyName: 'Acme' });
  });

  it('loads the team members', () => {
    api.getUsers().subscribe();

    const request = http.expectOne(`${baseUrl}/users`);
    expect(request.request.method).toBe('GET');
    request.flush([member()]);
  });

  it('creates a team member', () => {
    api
      .createUser({
        name: 'Ada Lovelace',
        email: 'ada@example.com',
        role: 'commercial',
        password: 'secret123',
        mustRenewPassword: true,
      })
      .subscribe();

    const request = http.expectOne(`${baseUrl}/users`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'commercial',
      password: 'secret123',
      mustRenewPassword: true,
    });
    request.flush(member());
  });

  it('patches one team member', () => {
    api.updateUser('user-1', { active: false }).subscribe();

    const request = http.expectOne(`${baseUrl}/users/user-1`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ active: false });
    request.flush({ ...member(), active: false });
  });

  it('deletes one team member', () => {
    api.deleteUser('user-1').subscribe();

    const request = http.expectOne(`${baseUrl}/users/user-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  function member(): TeamMember {
    return {
      id: 'user-1',
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      role: 'commercial',
      active: true,
      mustRenewPassword: false,
    };
  }
});

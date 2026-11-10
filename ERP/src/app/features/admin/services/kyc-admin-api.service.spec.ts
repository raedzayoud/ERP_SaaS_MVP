import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { KycAdminApiService } from './kyc-admin-api.service';

describe('KycAdminApiService', () => {
  let api: KycAdminApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(KycAdminApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lists signup reviews for a status', () => {
    api.list('PENDING').subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/admin/signups` &&
        candidate.params.get('status') === 'PENDING',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('approves a signup', () => {
    api.approve('tenant-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/signups/tenant-1/approve`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ message: 'signup approved' });
  });

  it('rejects a signup with a note', () => {
    api.reject('tenant-1', 'Missing documents').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/admin/signups/tenant-1/reject`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ note: 'Missing documents' });
    request.flush({ message: 'signup rejected' });
  });

  it('downloads a KYC document as a blob', () => {
    api.download('tenant-1', 'doc-1').subscribe((blob) => {
      expect(blob instanceof Blob).toBe(true);
    });

    const request = http.expectOne(
      `${environment.apiUrl}/admin/signups/tenant-1/documents/doc-1`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['scan'], { type: 'application/pdf' }));
  });
});

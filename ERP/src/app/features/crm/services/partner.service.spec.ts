import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PartnerInput } from '../models/partner';
import { PartnerService } from './partner.service';

const NEW_PARTNER: PartnerInput = {
  kind: 'company',
  name: 'Test Industries',
  parentId: null,
  isCustomer: true,
  isSupplier: false,
  taxId: '00000000/A/M/000',
  email: 'contact@test-industries.com',
  phone: '+216 71 000 000',
  jobTitle: '',
  address: { street: '1 Main Street', city: 'Tunis', country: 'TN' },
  notes: '',
};

describe('PartnerService', () => {
  let service: PartnerService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/crm/partners`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PartnerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the API for one filtered page of contacts', async () => {
    const page = firstValueFrom(
      service.getPartners({ page: 1, size: 10, search: 'acme', kind: 'company', active: true, sort: 'name,asc' }),
    );

    const request = http.expectOne(
      (req) =>
        req.url === baseUrl &&
        req.params.get('page') === '1' &&
        req.params.get('size') === '10' &&
        req.params.get('search') === 'acme' &&
        req.params.get('kind') === 'company' &&
        req.params.get('active') === 'true' &&
        req.params.get('sort') === 'name,asc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 1, size: 10 });

    expect((await page).total).toBe(0);
  });

  it('returns undefined for an unknown id', async () => {
    const partner = firstValueFrom(service.getPartner('does-not-exist'));

    const request = http.expectOne(`${baseUrl}/does-not-exist`);
    request.flush({ message: 'contact not found' }, { status: 404, statusText: 'Not Found' });

    expect(await partner).toBeUndefined();
  });

  it('creates a contact', async () => {
    const created = firstValueFrom(service.createPartner(NEW_PARTNER));

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.name).toBe('Test Industries');
    request.flush({ id: 'partner-1', ...NEW_PARTNER, active: true });

    expect((await created).id).toBe('partner-1');
  });

  it('archives and restores a contact', async () => {
    const archived = firstValueFrom(service.archivePartner('partner-1'));

    const request = http.expectOne(`${baseUrl}/partner-1/archive`);
    expect(request.request.method).toBe('PATCH');
    request.flush({ id: 'partner-1', active: false });

    expect((await archived).active).toBe(false);

    const restored = firstValueFrom(service.restorePartner('partner-1'));
    http.expectOne(`${baseUrl}/partner-1/restore`).flush({ id: 'partner-1', active: true });

    expect((await restored).active).toBe(true);
  });

  it('keeps the error code returned by the API', async () => {
    const failure = firstValueFrom(service.createPartner(NEW_PARTNER));

    http
      .expectOne(baseUrl)
      .flush(
        { message: 'parent contact not found', code: 'notFound' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(failure).rejects.toMatchObject({ code: 'notFound' });
  });
});

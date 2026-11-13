import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { LeadService } from './lead.service';

describe('LeadService', () => {
  let service: LeadService;
  let http: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/crm/leads`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('asks the API for the filtered leads', async () => {
    const page = firstValueFrom(
      service.getLeads({ page: 0, size: 200, search: 'nadia', status: 'new', sort: 'createdAt,desc' }),
    );

    const request = http.expectOne(
      (req) =>
        req.url === baseUrl &&
        req.params.get('page') === '0' &&
        req.params.get('size') === '200' &&
        req.params.get('search') === 'nadia' &&
        req.params.get('status') === 'new' &&
        req.params.get('sort') === 'createdAt,desc',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], total: 0, page: 0, size: 200 });

    expect((await page).total).toBe(0);
  });

  it('creates a lead and updates it', async () => {
    const created = firstValueFrom(
      service.saveDraft({
        id: null,
        name: 'Nadia Trabelsi',
        company: 'Carthage Logistics',
        email: 'nadia@example.com',
        phone: '',
        source: 'website',
        status: 'new',
        notes: '',
      }),
    );

    const request = http.expectOne(baseUrl);
    expect(request.request.method).toBe('POST');
    request.flush({ id: 'lead-1', status: 'new' });

    expect((await created).id).toBe('lead-1');

    const updated = firstValueFrom(
      service.saveDraft({
        id: 'lead-1',
        name: 'Nadia Trabelsi',
        company: 'Carthage Logistics',
        email: 'nadia@example.com',
        phone: '',
        source: 'referral',
        status: 'contacted',
        notes: '',
      }),
    );

    const updateRequest = http.expectOne(`${baseUrl}/lead-1`);
    expect(updateRequest.request.method).toBe('PUT');
    updateRequest.flush({ id: 'lead-1', status: 'contacted' });

    expect((await updated).status).toBe('contacted');
  });

  it('refuses a lead without a name before calling the API', async () => {
    await expect(
      firstValueFrom(
        service.saveDraft({
          id: null,
          name: '  ',
          company: '',
          email: '',
          phone: '',
          source: 'website',
          status: 'new',
          notes: '',
        }),
      ),
    ).rejects.toMatchObject({ code: 'noName' });

    http.verify();
  });

  it('converts a lead into a contact', async () => {
    const converted = firstValueFrom(service.convertLead('lead-1'));

    const request = http.expectOne(`${baseUrl}/lead-1/convert`);
    expect(request.request.method).toBe('POST');
    request.flush({ partnerId: 'partner-1', lead: { id: 'lead-1', status: 'converted' } });

    const result = await converted;
    expect(result.partnerId).toBe('partner-1');
    expect(result.lead.status).toBe('converted');
  });

  it('keeps the error code returned by the API', async () => {
    const failure = firstValueFrom(service.convertLead('lead-1'));

    http
      .expectOne(`${baseUrl}/lead-1/convert`)
      .flush(
        { message: 'lead already converted', code: 'alreadyConverted' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(failure).rejects.toMatchObject({ code: 'alreadyConverted' });
  });
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { LeadService } from './lead.service';
import { PartnerService } from './partner.service';

const NADIA = 'd4000000-0000-4000-8000-000000000001';

describe('LeadService', () => {
  let service: LeadService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LeadService);
  });

  it('lists seed leads with pagination', async () => {
    const page = await firstValueFrom(service.getLeads({ page: 0, size: 2 }));

    expect(page.total).toBe(4);
    expect(page.items.length).toBe(2);
  });

  it('filters leads by open status', async () => {
    const page = await firstValueFrom(service.getLeads({ page: 0, size: 10, status: 'new' }));

    expect(page.items.length).toBe(1);
    expect(page.items[0].name).toBe('Nadia Trabelsi');
  });

  it('searches leads by name or company', async () => {
    const page = await firstValueFrom(
      service.getLeads({ page: 0, size: 10, search: 'carthage' }),
    );

    expect(page.total).toBe(1);
    expect(page.items[0].email).toContain('carthage-log.tn');
  });

  it('converts a company lead into a company contact', async () => {
    const result = await firstValueFrom(service.convertLead(NADIA));

    expect(result.lead.status).toBe('converted');
    expect(result.lead.convertedPartnerId).toBeTruthy();

    const partners = TestBed.inject(PartnerService);
    const partner = await firstValueFrom(partners.getPartner(result.partnerId));
    expect(partner?.isCustomer).toBe(true);
  });

  it('refuses to convert the same lead twice', async () => {
    await firstValueFrom(service.convertLead(NADIA));

    const promise = firstValueFrom(service.convertLead(NADIA));
    await expect(promise).rejects.toMatchObject({ code: 'alreadyConverted' });
  });

  it('refuses to convert a lost lead', async () => {
    await firstValueFrom(service.loseLead(NADIA));

    const promise = firstValueFrom(service.convertLead(NADIA));
    await expect(promise).rejects.toMatchObject({ code: 'lostLead' });
  });

  it('refuses to save a lead without a name', async () => {
    const promise = firstValueFrom(
      service.saveDraft({
        id: null,
        name: '   ',
        company: '',
        email: '',
        phone: '',
        source: 'website',
        status: 'new',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'noName' });
  });
});

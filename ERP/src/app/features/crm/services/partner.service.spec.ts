import { firstValueFrom } from 'rxjs';
import { PartnerService } from './partner.service';
import { PartnerInput } from '../models/partner';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  beforeEach(() => {
    service = new PartnerService();
  });

  it('returns the first page with 10 items sorted by name', async () => {
    const page = await firstValueFrom(service.getPartners({ page: 0, size: 10 }));

    expect(page.items.length).toBe(10);
    expect(page.total).toBe(12);
    expect(page.page).toBe(0);
    expect(page.items[0].name).toBe('Acme Corp');
  });

  it('returns the remaining items on the second page', async () => {
    const page = await firstValueFrom(service.getPartners({ page: 1, size: 10 }));

    expect(page.items.length).toBe(2);
    expect(page.total).toBe(12);
    expect(page.page).toBe(1);
  });

  it('filters by partner kind', async () => {
    const page = await firstValueFrom(service.getPartners({ page: 0, size: 50, kind: 'person' }));

    expect(page.total).toBe(4);
    expect(page.items.every((partner) => partner.kind === 'person')).toBe(true);
  });

  it('filters archived partners', async () => {
    const page = await firstValueFrom(service.getPartners({ page: 0, size: 50, active: false }));

    expect(page.total).toBe(2);
    expect(page.items.every((partner) => !partner.active)).toBe(true);
  });

  it('searches the name and the parent company', async () => {
    const page = await firstValueFrom(service.getPartners({ page: 0, size: 50, search: 'acme' }));

    expect(page.items.map((partner) => partner.name)).toEqual(['Acme Corp', 'John Smith']);
  });

  it('sorts descending by creation date', async () => {
    const page = await firstValueFrom(
      service.getPartners({ page: 0, size: 50, sort: 'createdAt,desc' }),
    );

    const dates = page.items.map((partner) => partner.createdAt);
    expect(dates[0]).toBe('2026-05-06T10:35:00.000Z');
    expect(dates[dates.length - 1]).toBe('2026-01-12T09:00:00.000Z');
  });

  it('creates a partner with a generated id', async () => {
    const partner = await firstValueFrom(service.createPartner(NEW_PARTNER));

    expect(partner.id).toMatch(UUID);
    expect(partner.name).toBe('Test Industries');
    expect(partner.active).toBe(true);
    expect(partner.createdAt).toBeTruthy();
  });

  it('archives and restores a partner', async () => {
    const created = await firstValueFrom(service.createPartner(NEW_PARTNER));

    const archived = await firstValueFrom(service.archivePartner(created.id));
    expect(archived.active).toBe(false);

    const restored = await firstValueFrom(service.restorePartner(created.id));
    expect(restored.active).toBe(true);
  });

  it('returns undefined for an unknown id', async () => {
    const partner = await firstValueFrom(service.getPartner('does-not-exist'));

    expect(partner).toBeUndefined();
  });
});

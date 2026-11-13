import { of } from 'rxjs';
import { Partner } from '../models/partner';
import { PartnerService } from './partner.service';

/** Contact used by the feature specs that still run on mock data. */
export const TEST_PARTNER: Partner = {
  id: 'f4a1c2e0-8a01-4a10-9d21-000000000001',
  kind: 'company',
  name: 'Acme Corp',
  parentId: null,
  isCustomer: true,
  isSupplier: true,
  taxId: '12034567/A/M/000',
  email: 'billing@acme-corp.com',
  phone: '+1 415 555 0110',
  jobTitle: '',
  address: { street: '120 Market Street', city: 'San Francisco', country: 'US' },
  active: true,
  notes: '',
  createdAt: '2026-01-12T09:00:00.000Z',
  updatedAt: '2026-01-12T09:00:00.000Z',
};

/**
 * Keeps the mock features working while the contacts are served by the API.
 * shortcut: one shared contact for every mock spec; give each feature its own
 * fixture when a spec needs different customer data.
 */
export function partnerServiceStub() {
  return {
    provide: PartnerService,
    useValue: {
      getPartner: (id: string) => of({ ...TEST_PARTNER, id }),
      getPartners: () => of({ items: [TEST_PARTNER], total: 1, page: 0, size: 1 }),
    },
  };
}

import { Injectable, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { Partner, PartnerInput, PartnerQuery } from '../models/partner';

const LATENCY_MS = 300;

const SEED_PARTNERS: Partner[] = [
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000001',
    kind: 'company',
    name: 'Acme Corp',
    parentId: null,
    isCustomer: true,
    isSupplier: false,
    taxId: '12034567/A/M/000',
    email: 'billing@acme-corp.com',
    phone: '+1 415 555 0110',
    jobTitle: '',
    address: { street: '120 Market Street', city: 'San Francisco', country: 'US' },
    active: true,
    notes: 'Frame contract renewed annually.',
    createdAt: '2026-01-12T09:00:00.000Z',
    updatedAt: '2026-01-12T09:00:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000002',
    kind: 'company',
    name: 'Global Ltd',
    parentId: null,
    isCustomer: true,
    isSupplier: false,
    taxId: '09876543/B/M/000',
    email: 'accounts@global-ltd.co.uk',
    phone: '+44 20 7946 0001',
    jobTitle: '',
    address: { street: '5 Bishopsgate', city: 'London', country: 'GB' },
    active: true,
    notes: '',
    createdAt: '2026-01-20T11:30:00.000Z',
    updatedAt: '2026-01-20T11:30:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000003',
    kind: 'company',
    name: 'Nord Industries',
    parentId: null,
    isCustomer: false,
    isSupplier: true,
    taxId: '78-3345678',
    email: 'purchasing@nord-industries.de',
    phone: '+49 30 5550 0142',
    jobTitle: '',
    address: { street: 'Wiener Strasse 12', city: 'Berlin', country: 'DE' },
    active: true,
    notes: 'Preferred supplier for raw material A.',
    createdAt: '2026-02-03T08:15:00.000Z',
    updatedAt: '2026-02-03T08:15:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000004',
    kind: 'company',
    name: 'Atlas Digital',
    parentId: null,
    isCustomer: true,
    isSupplier: true,
    taxId: '08812345/A/M/000',
    email: 'hello@atlasdigital.tn',
    phone: '+216 71 962 000',
    jobTitle: '',
    address: { street: '12 Rue du Lac Léman', city: 'Tunis', country: 'TN' },
    active: true,
    notes: 'Client and supplier: we resell their hosting.',
    createdAt: '2026-02-14T14:45:00.000Z',
    updatedAt: '2026-02-14T14:45:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000005',
    kind: 'company',
    name: 'Delta Logistics',
    parentId: null,
    isCustomer: false,
    isSupplier: true,
    taxId: '11998877/C/M/000',
    email: 'ops@deltalogistics.fr',
    phone: '+33 4 72 55 00 12',
    jobTitle: '',
    address: { street: '8 Quai Perrache', city: 'Lyon', country: 'FR' },
    active: true,
    notes: '',
    createdAt: '2026-02-26T10:05:00.000Z',
    updatedAt: '2026-02-26T10:05:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000006',
    kind: 'company',
    name: 'Horizon Media',
    parentId: null,
    isCustomer: true,
    isSupplier: false,
    taxId: '22334455/D/M/000',
    email: 'finance@horizonmedia.com',
    phone: '+1 212 555 0177',
    jobTitle: '',
    address: { street: '450 Broadway', city: 'New York', country: 'US' },
    active: true,
    notes: '',
    createdAt: '2026-03-05T16:20:00.000Z',
    updatedAt: '2026-03-05T16:20:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000007',
    kind: 'company',
    name: 'Verde Manufacturing',
    parentId: null,
    isCustomer: false,
    isSupplier: true,
    taxId: '55667788/E/M/000',
    email: 'sales@verde-mfg.com',
    phone: '+1 312 555 0190',
    jobTitle: '',
    address: { street: '900 W Randolph St', city: 'Chicago', country: 'US' },
    active: true,
    notes: 'Leads time of 3 weeks.',
    createdAt: '2026-03-18T07:40:00.000Z',
    updatedAt: '2026-03-18T07:40:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000008',
    kind: 'company',
    name: 'Societe des Thermes',
    parentId: null,
    isCustomer: true,
    isSupplier: false,
    taxId: '04455667/F/M/000',
    email: 'contact@thermes.tn',
    phone: '+216 73 224 100',
    jobTitle: '',
    address: { street: 'Avenue Haffouz', city: 'Sousse', country: 'TN' },
    active: false,
    notes: 'Archived: contract ended in March.',
    createdAt: '2026-03-22T12:00:00.000Z',
    updatedAt: '2026-04-01T12:00:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000009',
    kind: 'person',
    name: 'John Smith',
    parentId: 'f4a1c2e0-8a01-4a10-9d21-000000000001',
    isCustomer: true,
    isSupplier: false,
    taxId: '',
    email: 'john.smith@acme-corp.com',
    phone: '+1 415 555 0111',
    jobTitle: 'Procurement Manager',
    address: { street: '120 Market Street', city: 'San Francisco', country: 'US' },
    active: true,
    notes: 'Main decision maker for renewals.',
    createdAt: '2026-04-02T09:10:00.000Z',
    updatedAt: '2026-04-02T09:10:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000010',
    kind: 'person',
    name: 'Leila Ben Salah',
    parentId: 'f4a1c2e0-8a01-4a10-9d21-000000000004',
    isCustomer: true,
    isSupplier: true,
    taxId: '',
    email: 'leila.bensalah@atlasdigital.tn',
    phone: '+216 22 334 556',
    jobTitle: 'Managing Director',
    address: { street: '12 Rue du Lac Léman', city: 'Tunis', country: 'TN' },
    active: true,
    notes: '',
    createdAt: '2026-04-11T13:25:00.000Z',
    updatedAt: '2026-04-11T13:25:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000011',
    kind: 'person',
    name: 'Marc Dupont',
    parentId: 'f4a1c2e0-8a01-4a10-9d21-000000000006',
    isCustomer: false,
    isSupplier: false,
    taxId: '',
    email: 'marc.dupont@old-agency.com',
    phone: '+1 646 555 0133',
    jobTitle: 'Former Account Contact',
    address: { street: '450 Broadway', city: 'New York', country: 'US' },
    active: false,
    notes: 'Archived: left the company.',
    createdAt: '2026-04-19T15:55:00.000Z',
    updatedAt: '2026-05-02T15:55:00.000Z',
  },
  {
    id: 'f4a1c2e0-8a01-4a10-9d21-000000000012',
    kind: 'person',
    name: 'Sara Nguyen',
    parentId: 'f4a1c2e0-8a01-4a10-9d21-000000000002',
    isCustomer: true,
    isSupplier: false,
    taxId: '',
    email: 'sara.nguyen@global-ltd.co.uk',
    phone: '+44 20 7946 0002',
    jobTitle: 'Finance Director',
    address: { street: '5 Bishopsgate', city: 'London', country: 'GB' },
    active: true,
    notes: 'Receives all invoices.',
    createdAt: '2026-05-06T10:35:00.000Z',
    updatedAt: '2026-05-06T10:35:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class PartnerService {
  private readonly items = signal<Partner[]>(SEED_PARTNERS);

  getPartners(query: PartnerQuery): Observable<Page<Partner>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getPartner(id: string): Observable<Partner | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((p) => p.id === id)));
  }

  createPartner(data: PartnerInput): Observable<Partner> {
    const now = new Date().toISOString();
    const partner: Partner = {
      id: this.newId(),
      active: true,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => [...list, partner]);
        return partner;
      }),
    );
  }

  updatePartner(id: string, data: PartnerInput): Observable<Partner> {
    return this.mutate(id, (existing) => ({
      ...existing,
      ...data,
      updatedAt: new Date().toISOString(),
    }));
  }

  archivePartner(id: string): Observable<Partner> {
    return this.mutate(id, (existing) => ({
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
    }));
  }

  restorePartner(id: string): Observable<Partner> {
    return this.mutate(id, (existing) => ({
      ...existing,
      active: true,
      updatedAt: new Date().toISOString(),
    }));
  }

  private buildPage(query: PartnerQuery): Page<Partner> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((partner) => {
      if (query.kind && partner.kind !== query.kind) return false;
      if (query.active !== undefined && partner.active !== query.active) return false;
      if (search && !this.matchesSearch(partner, search)) return false;
      return true;
    });

    const sorted = this.sortPartners(filtered, query.sort);

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(partner: Partner, search: string): boolean {
    const parent = partner.parentId
      ? this.items().find((p) => p.id === partner.parentId)
      : undefined;

    const haystack = [
      partner.name,
      partner.email,
      partner.phone,
      partner.taxId,
      partner.jobTitle,
      partner.address.city,
      partner.address.street,
      parent?.name ?? '',
    ];

    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortPartners(list: Partner[], sort: string | undefined): Partner[] {
    const [field, direction] = (sort ?? 'name,asc').split(',');
    const sign = direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
      if (field === 'createdAt') return a.createdAt.localeCompare(b.createdAt) * sign;
      return a.name.localeCompare(b.name) * sign;
    });
  }

  private mutate(id: string, apply: (partner: Partner) => Partner): Observable<Partner> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const existing = this.items().find((p) => p.id === id);
        if (!existing) {
          throw new Error(`Partner not found: ${id}`);
        }
        const updated = apply(existing);
        this.items.update((list) => list.map((p) => (p.id === id ? updated : p)));
        return updated;
      }),
    );
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

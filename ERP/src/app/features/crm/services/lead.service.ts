import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { PartnerInput } from '../models/partner';
import { PartnerService } from './partner.service';
import { Lead, LeadInput, LeadQuery, LeadSource } from '../models/lead';

const LATENCY_MS = 300;

export type LeadErrorCode = 'notFound' | 'alreadyConverted' | 'lostLead' | 'noName';

export class LeadError extends Error {
  constructor(readonly code: LeadErrorCode) {
    super(code);
  }
}

const SEED_LEADS: Lead[] = [
  {
    id: 'd4000000-0000-4000-8000-000000000001',
    name: 'Nadia Trabelsi',
    company: 'Carthage Logistics',
    email: 'nadia.trabelsi@carthage-log.tn',
    phone: '+216 71 000 001',
    source: 'website',
    status: 'new',
    convertedPartnerId: null,
    notes: 'Asked for a demo through the contact form.',
    createdAt: '2026-10-18T09:00:00.000Z',
    updatedAt: '2026-10-18T09:00:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000002',
    name: 'Paul Schmidt',
    company: 'Rhein Supplies GmbH',
    email: 'paul.schmidt@rhein-supplies.de',
    phone: '+49 30 1122 3344',
    source: 'referral',
    status: 'contacted',
    convertedPartnerId: null,
    notes: 'Referred by Global Ltd. Needs a quote for 3 subsidiaries.',
    createdAt: '2026-10-14T14:20:00.000Z',
    updatedAt: '2026-10-20T10:05:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000003',
    name: 'Fatma Gharbi',
    company: '',
    email: 'fatma.gharbi@mailbox.tn',
    phone: '+216 55 889 900',
    source: 'event',
    status: 'qualified',
    convertedPartnerId: null,
    notes: 'Met at the Tunis tech expo. Freelance consultant, self-employed.',
    createdAt: '2026-10-08T08:40:00.000Z',
    updatedAt: '2026-10-16T16:30:00.000Z',
  },
  {
    id: 'd4000000-0000-4000-8000-000000000004',
    name: 'Tom Rivera',
    company: 'Broadway Media',
    email: 'tom.rivera@broadwaymedia.us',
    phone: '+1 212 555 0177',
    source: 'cold_call',
    status: 'lost',
    convertedPartnerId: null,
    notes: 'Already using a competitor suite, not interested.',
    createdAt: '2026-09-28T11:10:00.000Z',
    updatedAt: '2026-10-05T09:45:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly items = signal<Lead[]>(SEED_LEADS);
  private readonly partners = inject(PartnerService);

  getLeads(query: LeadQuery): Observable<Page<Lead>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getLead(id: string): Observable<Lead | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((lead) => lead.id === id)));
  }

  saveDraft(data: LeadInput): Observable<Lead> {
    if (!data.name.trim()) return this.fail('noName');

    const existing = data.id ? this.items().find((lead) => lead.id === data.id) : undefined;
    if (data.id && !existing) return this.fail('notFound');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const now = new Date().toISOString();

        if (existing) {
          const updated: Lead = {
            ...existing,
            name: data.name,
            company: data.company,
            email: data.email,
            phone: data.phone,
            source: data.source,
            status: existing.status,
            notes: data.notes,
            updatedAt: now,
          };
          this.replace(updated);
          return updated;
        }

        const created: Lead = {
          id: this.newId(),
          name: data.name,
          company: data.company,
          email: data.email,
          phone: data.phone,
          source: data.source,
          status: 'new',
          convertedPartnerId: null,
          notes: data.notes,
          createdAt: now,
          updatedAt: now,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  deleteLead(id: string): Observable<void> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => list.filter((lead) => lead.id !== id));
      }),
    );
  }

  loseLead(id: string): Observable<Lead> {
    const existing = this.items().find((lead) => lead.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status === 'converted') return this.fail('alreadyConverted');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const lost: Lead = {
          ...existing,
          status: 'lost',
          updatedAt: new Date().toISOString(),
        };
        this.replace(lost);
        return lost;
      }),
    );
  }

  /**
   * Turns a lead into a real contact. A lead with a company name becomes
   * a company partner, otherwise a person. The lead is then closed.
   */
  convertLead(id: string): Observable<{ partnerId: string; lead: Lead }> {
    const existing = this.items().find((lead) => lead.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status === 'converted') return this.fail('alreadyConverted');
    if (existing.status === 'lost') return this.fail('lostLead');

    const input: PartnerInput = {
      kind: existing.company ? 'company' : 'person',
      name: existing.company || existing.name,
      parentId: null,
      isCustomer: true,
      isSupplier: false,
      taxId: '',
      email: existing.email,
      phone: existing.phone,
      jobTitle: existing.company ? '' : 'Customer',
      address: { street: '', city: '', country: '' },
      notes: `Converted from lead "${existing.name}". ${existing.notes}`.trim(),
    };

    return this.partners.createPartner(input).pipe(
      map((partner) => {
        const converted: Lead = {
          ...existing,
          status: 'converted',
          convertedPartnerId: partner.id,
          updatedAt: new Date().toISOString(),
        };
        this.replace(converted);
        return { partnerId: partner.id, lead: converted };
      }),
    );
  }

  sourceLabelKey(source: LeadSource): string {
    return `crm.leads.source.${source}`;
  }

  private buildPage(query: LeadQuery): Page<Lead> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((lead) => {
      if (query.status && lead.status !== query.status) return false;
      if (search && !this.matchesSearch(lead, search)) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const [field, direction] = (query.sort ?? 'createdAt,desc').split(',');
      const sign = direction === 'desc' ? -1 : 1;
      if (field === 'name') return a.name.localeCompare(b.name) * sign;
      return a.createdAt.localeCompare(b.createdAt) * sign;
    });

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(lead: Lead, search: string): boolean {
    const haystack = [lead.name, lead.company, lead.email];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private replace(updated: Lead): void {
    this.items.update((list) => list.map((lead) => (lead.id === updated.id ? updated : lead)));
  }

  private fail(code: LeadErrorCode): Observable<never> {
    return throwError(() => new LeadError(code));
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

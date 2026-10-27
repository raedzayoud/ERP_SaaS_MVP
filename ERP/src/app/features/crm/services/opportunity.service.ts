import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { PartnerService } from './partner.service';
import {
  Opportunity,
  OpportunityInput,
} from '../models/opportunity';
import {
  PipelineStage,
  isClosedStage,
  isOpenStage,
  pipelineStats,
} from '../models/pipeline';

const LATENCY_MS = 300;

export type OpportunityErrorCode =
  | 'notFound'
  | 'stageClosed'
  | 'noName'
  | 'noCustomer'
  | 'invalidAmount'
  | 'invalidStage'
  | 'dateInPast';

export class OpportunityError extends Error {
  constructor(readonly code: OpportunityErrorCode) {
    super(code);
  }
}

const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const HORIZON = 'f4a1c2e0-8a01-4a10-9d21-000000000006';

const SEED_OPPORTUNITIES: Opportunity[] = [
  {
    id: 'd5000000-0000-4000-8000-000000000001',
    name: 'Carthage Logistics rollout',
    customerId: ACME,
    stage: 'qualification',
    amount: 24000,
    currency: 'USD',
    expectedCloseDate: '2026-11-20',
    notes: 'Full suite demo requested, waiting for the IT steering committee.',
    originLeadId: null,
    createdAt: '2026-10-18T10:00:00.000Z',
    updatedAt: '2026-10-18T10:00:00.000Z',
  },
  {
    id: 'd5000000-0000-4000-8000-000000000002',
    name: 'Global Ltd expansion',
    customerId: GLOBAL,
    stage: 'proposal',
    amount: 18500,
    currency: 'USD',
    expectedCloseDate: '2026-11-05',
    notes: 'Proposal sent for the purchases + stock modules.',
    originLeadId: null,
    createdAt: '2026-10-10T09:30:00.000Z',
    updatedAt: '2026-10-19T15:10:00.000Z',
  },
  {
    id: 'd5000000-0000-4000-8000-000000000003',
    name: 'Atlas Digital margin gains',
    customerId: ATLAS,
    stage: 'negotiation',
    amount: 9800,
    currency: 'USD',
    expectedCloseDate: '2026-10-28',
    notes: 'Negotiating the invoicing settings add-on.',
    originLeadId: null,
    createdAt: '2026-10-05T08:15:00.000Z',
    updatedAt: '2026-10-21T11:45:00.000Z',
  },
  {
    id: 'd5000000-0000-4000-8000-000000000004',
    name: 'Horizon Media founder pack',
    customerId: HORIZON,
    stage: 'won',
    amount: 6400,
    currency: 'USD',
    expectedCloseDate: '2026-10-02',
    notes: 'Signed for sales + invoicing.',
    originLeadId: null,
    createdAt: '2026-09-12T09:00:00.000Z',
    updatedAt: '2026-10-02T17:00:00.000Z',
  },
  {
    id: 'd5000000-0000-4000-8000-000000000005',
    name: 'Thermes stock revamp',
    customerId: 'f4a1c2e0-8a01-4a10-9d21-000000000008',
    stage: 'won',
    amount: 5200,
    currency: 'USD',
    expectedCloseDate: '2026-09-25',
    notes: 'Stock + reports modules, yearly plan.',
    originLeadId: null,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-25T16:30:00.000Z',
  },
  {
    id: 'd5000000-0000-4000-8000-000000000006',
    name: 'Broadway Media suite',
    customerId: ACME,
    stage: 'lost',
    amount: 15000,
    currency: 'USD',
    expectedCloseDate: '2026-10-12',
    notes: 'Lost to a competing offer.',
    originLeadId: null,
    createdAt: '2026-09-08T14:00:00.000Z',
    updatedAt: '2026-10-12T18:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class OpportunityService {
  private readonly items = signal<Opportunity[]>(SEED_OPPORTUNITIES);
  private readonly partners = inject(PartnerService);

  getOpportunities(): Observable<Opportunity[]> {
    return timer(LATENCY_MS).pipe(
      map(() => [...this.items()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))),
    );
  }

  getOpportunity(id: string): Observable<Opportunity | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((item) => item.id === id)));
  }

  stats(): Observable<ReturnType<typeof pipelineStats>> {
    return timer(LATENCY_MS).pipe(map(() => pipelineStats(this.items())));
  }

  saveDraft(data: OpportunityInput): Observable<Opportunity> {
    const invalid = this.validate(data);
    if (invalid) return this.fail(invalid);

    const existing = data.id ? this.items().find((item) => item.id === data.id) : undefined;
    if (data.id && !existing) return this.fail('notFound');

    return this.partners.getPartner(data.customerId).pipe(
      switchMap((partner) => {
        if (!partner) return this.fail('noCustomer');

        return timer(LATENCY_MS).pipe(
          map(() => {
            const now = new Date().toISOString();

            if (existing) {
              const updated: Opportunity = {
                ...existing,
                name: data.name,
                customerId: data.customerId,
                stage: data.stage,
                amount: data.amount,
                expectedCloseDate: data.expectedCloseDate,
                notes: data.notes,
                updatedAt: now,
              };
              this.replace(updated);
              return updated;
            }

            const created: Opportunity = {
              ...data,
              id: this.newId(),
              currency: 'USD',
              originLeadId: null,
              createdAt: now,
              updatedAt: now,
            };
            this.items.update((list) => [...list, created]);
            return created;
          }),
        );
      }),
    );
  }

  deleteOpportunity(id: string): Observable<void> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => list.filter((item) => item.id !== id));
      }),
    );
  }

  /** Cards can move freely between open columns; won/lost columns are final. */
  updateStage(id: string, stage: PipelineStage): Observable<Opportunity> {
    const existing = this.items().find((item) => item.id === id);
    if (!existing) return this.fail('notFound');
    if (!isOpenStage(stage) && !isClosedStage(stage)) return this.fail('invalidStage');
    if (isClosedStage(existing.stage)) return this.fail('stageClosed');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const updated: Opportunity = {
          ...existing,
          stage,
          updatedAt: new Date().toISOString(),
        };
        this.replace(updated);
        return updated;
      }),
    );
  }

  private validate(data: OpportunityInput): OpportunityErrorCode | null {
    if (!data.name.trim()) return 'noName';
    if (!data.customerId) return 'noCustomer';
    if (!(data.amount > 0)) return 'invalidAmount';
    if (!isOpenStage(data.stage) && !isClosedStage(data.stage)) return 'invalidStage';
    return null;
  }

  private replace(updated: Opportunity): void {
    this.items.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  private fail(code: OpportunityErrorCode): Observable<never> {
    return throwError(() => new OpportunityError(code));
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

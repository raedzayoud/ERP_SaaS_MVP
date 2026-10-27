import { Injectable, signal } from '@angular/core';
import { Observable, map, throwError, timer } from 'rxjs';
import { CrmInteraction, CrmInteractionInput } from '../models/crm-interaction';

const LATENCY_MS = 300;

export type InteractionErrorCode = 'notFound' | 'noPartner' | 'noSubject' | 'noType';

export class InteractionError extends Error {
  constructor(readonly code: InteractionErrorCode) {
    super(code);
  }
}

const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const HORIZON = 'f4a1c2e0-8a01-4a10-9d21-000000000006';

const SEED_INTERACTIONS: CrmInteraction[] = [
  {
    id: 'd6000000-0000-4000-8000-000000000001',
    partnerId: ATLAS,
    type: 'call',
    date: '2026-10-21',
    subject: 'Follow-up on the invoicing add-on',
    notes: 'They want stamp duty handling for B2C invoices.',
    reminderAt: '2026-10-27',
    reminderDone: false,
    createdAt: '2026-10-21T09:15:00.000Z',
  },
  {
    id: 'd6000000-0000-4000-8000-000000000002',
    partnerId: ATLAS,
    type: 'meeting',
    date: '2026-10-14',
    subject: 'Quarterly business review',
    notes: 'Renewal confirmed for next year, upsell discussion started.',
    reminderAt: null,
    reminderDone: false,
    createdAt: '2026-10-14T16:40:00.000Z',
  },
  {
    id: 'd6000000-0000-4000-8000-000000000003',
    partnerId: GLOBAL,
    type: 'email',
    date: '2026-10-19',
    subject: 'Purchase modules proposal sent',
    notes: 'Sent the pricing for the 3 subsidiaries.',
    reminderAt: '2026-10-24',
    reminderDone: false,
    createdAt: '2026-10-19T11:05:00.000Z',
  },
  {
    id: 'd6000000-0000-4000-8000-000000000004',
    partnerId: GLOBAL,
    type: 'note',
    date: '2026-10-12',
    subject: 'Internal note: sensitive to discounts',
    notes: 'Finance director pushes hard on multi-year discount.',
    reminderAt: null,
    reminderDone: false,
    createdAt: '2026-10-12T13:20:00.000Z',
  },
  {
    id: 'd6000000-0000-4000-8000-000000000005',
    partnerId: HORIZON,
    type: 'call',
    date: '2026-10-02',
    subject: 'Contract signature call',
    notes: 'Founder pack signed, onboarding scheduled.',
    reminderAt: null,
    reminderDone: false,
    createdAt: '2026-10-02T15:55:00.000Z',
  },
  {
    id: 'd6000000-0000-4000-8000-000000000006',
    partnerId: ACME,
    type: 'meeting',
    date: '2026-10-22',
    subject: 'Full suite demo',
    notes: 'IT steering committee asked for a second session.',
    reminderAt: '2026-11-03',
    reminderDone: false,
    createdAt: '2026-10-22T10:30:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class InteractionService {
  private readonly items = signal<CrmInteraction[]>(SEED_INTERACTIONS);

  getForPartner(partnerId: string): Observable<CrmInteraction[]> {
    return timer(LATENCY_MS).pipe(
      map(() =>
        this.items()
          .filter((item) => item.partnerId === partnerId)
          .sort((a, b) => b.date.localeCompare(a.date)),
      ),
    );
  }

  /** Pending reminders: not done, sorted from the most urgent. */
  getPendingReminders(): Observable<CrmInteraction[]> {
    return timer(LATENCY_MS).pipe(
      map(() =>
        this.items()
          .filter((item) => item.reminderAt !== null && !item.reminderDone)
          .sort(
            (a, b) =>
              (a.reminderAt ?? '').localeCompare(b.reminderAt ?? '') ||
              a.date.localeCompare(b.date),
          ),
      ),
    );
  }

  save(input: CrmInteractionInput): Observable<CrmInteraction> {
    if (!input.partnerId) return this.fail('noPartner');
    if (!input.subject.trim()) return this.fail('noSubject');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const now = new Date().toISOString();
        const existing = input.id
          ? this.items().find((item) => item.id === input.id)
          : undefined;

        if (existing) {
          const updated: CrmInteraction = {
            ...existing,
            type: input.type,
            date: input.date,
            subject: input.subject,
            notes: input.notes,
            reminderAt: input.reminderAt,
          };
          this.replace(updated);
          return updated;
        }

        const created: CrmInteraction = {
          id: this.newId(),
          partnerId: input.partnerId,
          type: input.type,
          date: input.date,
          subject: input.subject,
          notes: input.notes,
          reminderAt: input.reminderAt,
          reminderDone: false,
          createdAt: now,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  delete(id: string): Observable<void> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => list.filter((item) => item.id !== id));
      }),
    );
  }

  markReminderDone(id: string): Observable<CrmInteraction> {
    const existing = this.items().find((item) => item.id === id);
    if (!existing) return this.fail('notFound');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const updated: CrmInteraction = { ...existing, reminderDone: true };
        this.replace(updated);
        return updated;
      }),
    );
  }

  private replace(updated: CrmInteraction): void {
    this.items.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  private fail(code: InteractionErrorCode): Observable<never> {
    return throwError(() => new InteractionError(code));
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

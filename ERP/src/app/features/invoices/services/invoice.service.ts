import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { Partner } from '../../crm/models/partner';
import { PartnerService } from '../../crm/services/partner.service';
import { Page } from '../../../shared/models/page';
import { roundMoney, todayIso } from '../../../shared/utils/money';
import { MAIN_WAREHOUSE_ID } from '../../stock/models/warehouse';
import { StockService } from '../../stock/services/stock.service';
import { InvoicingSettingsService } from '../../invoicing/services/invoicing-settings.service';
import {
  CustomerSnapshot,
  Invoice,
  InvoiceDraftInput,
  InvoiceKind,
  InvoiceLine,
  InvoiceQuery,
  InvoiceSummary,
} from '../models/invoice';
import {
  invoiceTotals,
  isIssueDateChronological,
  paymentState,
  summaryOf,
} from '../utils/invoice-calc';

const LATENCY_MS = 300;

export type InvoiceErrorCode =
  | 'notFound'
  | 'notDraft'
  | 'noLines'
  | 'missingCustomer'
  | 'dateOutOfOrder'
  | 'originMissing'
  | 'originNotPosted'
  | 'insufficientStock'
  | 'invalidAmount'
  | 'overpaid'
  | 'notQuote'
  | 'quoteAlreadyConverted';

export class InvoiceError extends Error {
  constructor(readonly code: InvoiceErrorCode) {
    super(code);
  }
}

const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const HORIZON = 'f4a1c2e0-8a01-4a10-9d21-000000000006';

const LAPTOP = 'a1000000-0000-4000-8000-000000000001';
const MOUSE = 'a1000000-0000-4000-8000-000000000002';
const INSTALL = 'a1000000-0000-4000-8000-000000000005';
const SUPPORT = 'a1000000-0000-4000-8000-000000000006';
const CONSULT = 'a1000000-0000-4000-8000-000000000007';

function line(
  id: string,
  productId: string,
  description: string,
  quantity: number,
  unitPrice: number,
  vatRate: number,
  discountPct = 0,
): InvoiceLine {
  return { id, productId, description, quantity, unitPrice, discountPct, vatRate };
}

const SEED_INVOICES: Invoice[] = [
  {
    id: 'c3000000-0000-4000-8000-000000000001',
    number: null,
    kind: 'invoice',
    status: 'draft',
    customerId: ACME,
    customerSnapshot: {
      name: 'Acme Corp',
      taxId: '12034567/A/M/000',
      address: '120 Market Street, San Francisco, US',
    },
    issueDate: '2026-10-18',
    dueDate: '2026-11-17',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [
      line('l-1001', LAPTOP, 'Laptop Pro 14', 1, 1299, 19),
      line('l-1002', SUPPORT, 'Monthly Support', 1, 150, 19),
    ],
    stampDuty: 0,
    amountPaid: 0,
    notes: '',
    originInvoiceId: null,
    createdAt: '2026-10-18T09:15:00.000Z',
    updatedAt: '2026-10-18T09:15:00.000Z',
    postedAt: null,
  },
  {
    id: 'c3000000-0000-4000-8000-000000000002',
    number: 'FAC-2026-0001',
    kind: 'invoice',
    status: 'posted',
    customerId: GLOBAL,
    customerSnapshot: {
      name: 'Global Ltd',
      taxId: '09876543/B/M/000',
      address: '5 Bishopsgate, London, GB',
    },
    issueDate: '2026-10-10',
    dueDate: '2026-11-09',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [
      line('l-1003', MOUSE, 'Wireless Mouse', 10, 24.9, 19, 5),
      line('l-1004', INSTALL, 'Installation Service', 6, 60, 13),
    ],
    stampDuty: 0,
    amountPaid: 0,
    notes: '',
    originInvoiceId: null,
    createdAt: '2026-10-10T11:00:00.000Z',
    updatedAt: '2026-10-10T11:05:00.000Z',
    postedAt: '2026-10-10T11:05:00.000Z',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000003',
    number: 'FAC-2026-0002',
    kind: 'invoice',
    status: 'posted',
    customerId: ATLAS,
    customerSnapshot: {
      name: 'Atlas Digital',
      taxId: '08812345/A/M/000',
      address: '12 Rue du Lac Leman, Tunis, TN',
    },
    issueDate: '2026-08-20',
    dueDate: '2026-09-19',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [line('l-1005', CONSULT, 'Consulting Day', 5, 720, 7)],
    stampDuty: 0,
    amountPaid: 0,
    notes: '',
    originInvoiceId: null,
    createdAt: '2026-08-20T08:30:00.000Z',
    updatedAt: '2026-08-20T08:45:00.000Z',
    postedAt: '2026-08-20T08:45:00.000Z',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000004',
    number: 'FAC-2026-0003',
    kind: 'invoice',
    status: 'posted',
    customerId: HORIZON,
    customerSnapshot: {
      name: 'Horizon Media',
      taxId: '22334455/D/M/000',
      address: '450 Broadway, New York, US',
    },
    issueDate: '2026-09-28',
    dueDate: '2026-10-28',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [line('l-1006', INSTALL, 'Installation Service', 40, 60, 13)],
    stampDuty: 0,
    amountPaid: 1000,
    notes: '',
    originInvoiceId: null,
    createdAt: '2026-09-28T14:20:00.000Z',
    updatedAt: '2026-10-02T10:10:00.000Z',
    postedAt: '2026-09-28T14:25:00.000Z',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000005',
    number: 'FAC-2026-0004',
    kind: 'invoice',
    status: 'posted',
    customerId: ACME,
    customerSnapshot: {
      name: 'Acme Corp',
      taxId: '12034567/A/M/000',
      address: '120 Market Street, San Francisco, US',
    },
    issueDate: '2026-09-10',
    dueDate: '2026-09-25',
    paymentTerms: 'net15',
    currency: 'USD',
    lines: [
      line('l-1007', LAPTOP, 'Laptop Pro 14', 2, 1299, 19, 10),
      line('l-1008', CONSULT, 'Consulting Day', 1, 720, 7),
    ],
    stampDuty: 0,
    amountPaid: 3552.86,
    notes: 'Paid by bank transfer.',
    originInvoiceId: null,
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-24T16:40:00.000Z',
    postedAt: '2026-09-10T10:05:00.000Z',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000006',
    number: 'AV-2026-0001',
    kind: 'credit_note',
    status: 'posted',
    customerId: ACME,
    customerSnapshot: {
      name: 'Acme Corp',
      taxId: '12034567/A/M/000',
      address: '120 Market Street, San Francisco, US',
    },
    issueDate: '2026-10-05',
    dueDate: '2026-10-05',
    paymentTerms: 'immediate',
    currency: 'USD',
    lines: [line('l-1009', CONSULT, 'Consulting Day cancelled', 1, 720, 7)],
    stampDuty: 0,
    amountPaid: 0,
    notes: 'Credit note for FAC-2026-0004, cancelled consulting day.',
    originInvoiceId: 'c3000000-0000-4000-8000-000000000005',
    createdAt: '2026-10-05T09:00:00.000Z',
    updatedAt: '2026-10-05T09:05:00.000Z',
    postedAt: '2026-10-05T09:05:00.000Z',
  },
  {
    id: 'c3000000-0000-4000-8000-000000000007',
    number: null,
    kind: 'quote',
    status: 'draft',
    customerId: HORIZON,
    customerSnapshot: {
      name: 'Horizon Media',
      taxId: '22334455/D/M/000',
      address: '450 Broadway, New York, US',
    },
    issueDate: '2026-10-22',
    dueDate: '2026-11-21',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [
      line('l-1010', LAPTOP, 'Laptop Pro 14', 3, 1299, 19, 5),
      line('l-1011', SUPPORT, 'Monthly Support', 3, 150, 19),
    ],
    stampDuty: 0,
    amountPaid: 0,
    notes: 'Quote for the new marketing team devices.',
    originInvoiceId: null,
    createdAt: '2026-10-22T10:00:00.000Z',
    updatedAt: '2026-10-22T10:00:00.000Z',
    postedAt: null,
  },
  {
    id: 'c3000000-0000-4000-8000-000000000008',
    number: 'DEV-2026-0001',
    kind: 'quote',
    status: 'posted',
    customerId: GLOBAL,
    customerSnapshot: {
      name: 'Global Ltd',
      taxId: '09876543/B/M/000',
      address: '5 Bishopsgate, London, GB',
    },
    issueDate: '2026-10-08',
    dueDate: '2026-11-07',
    paymentTerms: 'net30',
    currency: 'USD',
    lines: [
      line('l-1012', LAPTOP, 'Laptop Pro 14', 5, 1299, 19, 10),
      line('l-1013', INSTALL, 'Installation Service', 5, 60, 13),
    ],
    stampDuty: 0,
    amountPaid: 0,
    notes: 'Annual refresh of the London office laptops.',
    originInvoiceId: null,
    createdAt: '2026-10-08T09:00:00.000Z',
    updatedAt: '2026-10-08T09:10:00.000Z',
    postedAt: '2026-10-08T09:10:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly items = signal<Invoice[]>(SEED_INVOICES);
  private readonly partners = inject(PartnerService);
  private readonly stock = inject(StockService);
  private readonly invoicingSettings = inject(InvoicingSettingsService);

  getInvoices(query: InvoiceQuery): Observable<Page<Invoice>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getInvoice(id: string): Observable<Invoice | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((i) => i.id === id)));
  }

  getSummary(currency: string): Observable<InvoiceSummary> {
    return timer(LATENCY_MS).pipe(map(() => summaryOf(this.items(), currency)));
  }

  getLastPostedIssueDate(kind: InvoiceKind, issueDate: string): Observable<string | null> {
    return timer(LATENCY_MS).pipe(map(() => this.lastPostedIssueDate(kind, issueDate)));
  }

  getCreditNotesFor(invoiceId: string): Observable<Invoice[]> {
    return timer(LATENCY_MS).pipe(
      map(() => this.items().filter((invoice) => invoice.originInvoiceId === invoiceId)),
    );
  }

  getInvoiceForQuote(quoteId: string): Observable<Invoice | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => this.items().find((invoice) => invoice.originInvoiceId === quoteId)),
    );
  }

  convertQuoteToInvoice(quoteId: string): Observable<Invoice> {
    return this.getInvoice(quoteId).pipe(
      switchMap((quote) => {
        if (!quote) return this.fail('notFound');
        if (quote.kind !== 'quote') return this.fail('notQuote');
        if (quote.status !== 'posted') return this.fail('notDraft');
        if (this.items().some((invoice) => invoice.originInvoiceId === quote.id)) {
          return this.fail('quoteAlreadyConverted');
        }

        return this.withPartner(quote.customerId, (partner) => {
          const now = new Date().toISOString();
          const created: Invoice = {
            id: this.newId(),
            number: null,
            kind: 'invoice',
            status: 'draft',
            customerId: quote.customerId,
            customerSnapshot: toSnapshot(partner),
            issueDate: todayIso(),
            dueDate: quote.dueDate,
            paymentTerms: quote.paymentTerms,
            currency: quote.currency,
            lines: quote.lines.map((item) => ({ ...item, id: this.newId() })),
            stampDuty: quote.stampDuty,
            amountPaid: 0,
            notes: quote.notes,
            originInvoiceId: quote.id,
            createdAt: now,
            updatedAt: now,
            postedAt: null,
          };
          this.items.update((list) => [...list, created]);
          return created;
        });
      }),
    );
  }

  addPayment(invoiceId: string, amount: number): Observable<Invoice> {
    const existing = this.items().find((invoice) => invoice.id === invoiceId);
    if (!existing) return this.fail('notFound');
    if (!(amount > 0)) return this.fail('invalidAmount');

    const { totalToPay, amountPaid } = invoiceTotals(existing);
    if (amountPaid + amount > totalToPay) return this.fail('overpaid');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const updated: Invoice = {
          ...existing,
          amountPaid: roundMoney(amountPaid + amount, existing.currency),
          updatedAt: new Date().toISOString(),
        };
        this.replace(updated);
        return updated;
      }),
    );
  }

  saveDraft(data: InvoiceDraftInput): Observable<Invoice> {
    const invalid = this.validateDraft(data);
    if (invalid) return this.fail(invalid);

    const existing = data.id ? this.items().find((invoice) => invoice.id === data.id) : undefined;
    if (data.id) {
      if (!existing) return this.fail('notFound');
      if (existing.status !== 'draft') return this.fail('notDraft');
    }

    return this.withPartner(data.customerId, (partner) => {
      const now = new Date().toISOString();
      const snapshot = toSnapshot(partner);

      if (existing) {
        const updated: Invoice = {
          ...existing,
          kind: data.kind,
          customerId: data.customerId,
          customerSnapshot: snapshot,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          paymentTerms: data.paymentTerms,
          currency: data.currency,
          stampDuty: data.stampDuty,
          notes: data.notes,
          originInvoiceId: data.originInvoiceId,
          lines: data.lines.map((item) => ({ id: this.newId(), ...item })),
          updatedAt: now,
        };
        this.replace(updated);
        return updated;
      }

      const created: Invoice = {
        id: this.newId(),
        number: null,
        kind: data.kind,
        status: 'draft',
        customerId: data.customerId,
        customerSnapshot: snapshot,
        issueDate: data.issueDate,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms,
        currency: data.currency,
        lines: data.lines.map((item) => ({ id: this.newId(), ...item })),
        stampDuty: data.stampDuty,
        amountPaid: 0,
        notes: data.notes,
        originInvoiceId: data.originInvoiceId,
        createdAt: now,
        updatedAt: now,
        postedAt: null,
      };
      this.items.update((list) => [...list, created]);
      return created;
    });
  }

  postInvoice(id: string): Observable<Invoice> {
    return this.getInvoice(id).pipe(
      switchMap((invoice) => {
        if (!invoice) return this.fail('notFound');
        if (invoice.status !== 'draft') return this.fail('notDraft');
        if (invoice.lines.length === 0) return this.fail('noLines');
        if (!invoice.customerId) return this.fail('missingCustomer');

        const lastPosted = this.lastPostedIssueDate(invoice.kind, invoice.issueDate);
        if (!isIssueDateChronological(invoice.issueDate, lastPosted)) {
          return this.fail('dateOutOfOrder');
        }

        const stockCheck$ =
          invoice.kind === 'invoice'
            ? this.stock
                .checkAvailability(MAIN_WAREHOUSE_ID, invoice.lines)
                .pipe(
                  switchMap((issues) =>
                    issues.length > 0 ? this.fail('insufficientStock') : of(invoice),
                  ),
                )
            : of(invoice);

        return stockCheck$.pipe(
          switchMap(() =>
            this.withPartner(invoice.customerId, (partner) => {
              const now = new Date().toISOString();
              const posted: Invoice = {
                ...invoice,
                number: this.nextNumber(invoice.kind, invoice.issueDate),
                status: 'posted',
                customerSnapshot: toSnapshot(partner),
                postedAt: now,
                updatedAt: now,
              };
              this.replace(posted);
              return posted;
            }),
          ),
          switchMap((posted) => {
            if (posted.kind !== 'invoice') return of(posted);

            return this.stock
              .recordSalePosting({
                refId: posted.id,
                date: posted.issueDate,
                warehouseId: MAIN_WAREHOUSE_ID,
                items: posted.lines
                  .filter(
                    (line): line is InvoiceLine & { productId: string } => line.productId !== null,
                  )
                  .map((line) => ({ productId: line.productId, quantity: line.quantity })),
              })
              .pipe(map(() => posted));
          }),
        );
      }),
    );
  }

  deleteDraft(id: string): Observable<void> {
    const existing = this.items().find((invoice) => invoice.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'draft') return this.fail('notDraft');

    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => list.filter((invoice) => invoice.id !== id));
      }),
    );
  }

  private validateDraft(data: InvoiceDraftInput): InvoiceErrorCode | null {
    if (data.lines.length === 0) return 'noLines';
    if (!data.customerId) return 'missingCustomer';
    if (data.kind === 'credit_note') {
      if (!data.originInvoiceId) return 'originMissing';
      const origin = this.items().find((invoice) => invoice.id === data.originInvoiceId);
      if (!origin || origin.status !== 'posted') return 'originNotPosted';
    }
    return null;
  }

  private withPartner<T>(customerId: string, next: (partner: Partner) => T): Observable<T> {
    return this.partners.getPartner(customerId).pipe(
      switchMap((partner) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            if (!partner) throw new InvoiceError('missingCustomer');
            return next(partner);
          }),
        ),
      ),
    );
  }

  private fail(code: InvoiceErrorCode): Observable<never> {
    return throwError(() => new InvoiceError(code));
  }

  private replace(updated: Invoice): void {
    this.items.update((list) =>
      list.map((invoice) => (invoice.id === updated.id ? updated : invoice)),
    );
  }

  private lastPostedIssueDate(kind: InvoiceKind, issueDate: string): string | null {
    const year = issueDate.slice(0, 4);
    let latest: string | null = null;

    for (const invoice of this.items()) {
      if (invoice.status !== 'posted' || invoice.kind !== kind) continue;
      if (!invoice.issueDate.startsWith(year)) continue;
      if (latest === null || invoice.issueDate > latest) latest = invoice.issueDate;
    }

    return latest;
  }

  private nextNumber(kind: InvoiceKind, issueDate: string): string {
    const prefix = this.invoicingSettings.prefixFor(kind);
    const year = issueDate.slice(0, 4);
    let sequence = 0;

    for (const invoice of this.items()) {
      if (invoice.status !== 'posted' || invoice.kind !== kind || !invoice.number) continue;
      const [prefixPart, yearPart, sequencePart] = invoice.number.split('-');
      if (prefixPart !== prefix || yearPart !== year) continue;
      const value = Number(sequencePart);
      if (Number.isFinite(value) && value > sequence) sequence = value;
    }

    return `${prefix}-${year}-${String(sequence + 1).padStart(4, '0')}`;
  }

  private buildPage(query: InvoiceQuery): Page<Invoice> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((invoice) => {
      if (query.status && invoice.status !== query.status) return false;
      if (query.kinds && !query.kinds.includes(invoice.kind)) return false;
      if (query.paid && paymentState(invoice) !== query.paid) return false;
      if (query.from && invoice.issueDate < query.from) return false;
      if (query.to && invoice.issueDate > query.to) return false;
      if (search && !this.matchesSearch(invoice, search)) return false;
      return true;
    });

    const sorted = this.sortInvoices(filtered, query.sort);

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(invoice: Invoice, search: string): boolean {
    const haystack = [invoice.number ?? '', invoice.customerSnapshot?.name ?? ''];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortInvoices(list: Invoice[], sort: string | undefined): Invoice[] {
    const [field, direction] = (sort ?? 'issueDate,desc').split(',');
    const sign = direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
      if (field === 'dueDate') return a.dueDate.localeCompare(b.dueDate) * sign;
      if (field === 'total') return (totalOf(a) - totalOf(b)) * sign;
      return a.issueDate.localeCompare(b.issueDate) * sign;
    });
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

function toSnapshot(partner: Partner): CustomerSnapshot {
  const { street, city, country } = partner.address;
  return { name: partner.name, taxId: partner.taxId, address: `${street}, ${city}, ${country}` };
}

function totalOf(invoice: Invoice): number {
  return invoiceTotals(invoice).totalTtc;
}

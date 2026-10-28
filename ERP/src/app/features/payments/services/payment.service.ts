import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { Invoice } from '../../invoices/models/invoice';
import { invoiceTotals } from '../../invoices/utils/invoice-calc';
import { InvoiceService } from '../../invoices/services/invoice.service';
import {
  Payment,
  PaymentInput,
  PaymentQuery,
  SupplierBillPayer,
} from '../models/payment';

const LATENCY_MS = 300;

export type PaymentErrorCode =
  'notFound' | 'invalidAmount' | 'invoiceNotFound' | 'invoiceNotPosted' | 'overpaid';

export class PaymentError extends Error {
  constructor(readonly code: PaymentErrorCode) {
    super(code);
  }
}

const FAC_0003 = 'c3000000-0000-4000-8000-000000000004';
const FAC_0004 = 'c3000000-0000-4000-8000-000000000005';
const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const HORIZON = 'f4a1c2e0-8a01-4a10-9d21-000000000006';
const NORD = 'f4a1c2e0-8a01-4a10-9d21-000000000003';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';

/** Seed ids of the supplier bills paid below (defined in supplier-bill.service.ts). */
const FA_ATLAS = 'f7000000-0000-4000-8000-000000000001';
const FA_NORD = 'f7000000-0000-4000-8000-000000000002';

const SEED_PAYMENTS: Payment[] = [
  {
    id: 'e5000000-0000-4000-8000-000000000001',
    invoiceId: FAC_0004,
    invoiceNumber: 'FAC-2026-0004',
    partnerId: ACME,
    partnerName: 'Acme Corp',
    date: '2026-09-15',
    amount: 2000,
    mode: 'transfer',
    reference: 'VIR-88421',
    currency: 'USD',
    notes: 'First installment.',
    direction: 'in',
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
  },
  {
    id: 'e5000000-0000-4000-8000-000000000002',
    invoiceId: FAC_0004,
    invoiceNumber: 'FAC-2026-0004',
    partnerId: ACME,
    partnerName: 'Acme Corp',
    date: '2026-09-24',
    amount: 1552.86,
    mode: 'card',
    reference: 'CB-771009',
    currency: 'USD',
    notes: 'Balance settled by card.',
    direction: 'in',
    createdAt: '2026-09-24T16:35:00.000Z',
    updatedAt: '2026-09-24T16:35:00.000Z',
  },
  {
    id: 'e5000000-0000-4000-8000-000000000003',
    invoiceId: FAC_0003,
    invoiceNumber: 'FAC-2026-0003',
    partnerId: HORIZON,
    partnerName: 'Horizon Media',
    date: '2026-10-02',
    amount: 1000,
    mode: 'check',
    reference: 'CHQ-20458',
    currency: 'USD',
    notes: 'Partial payment by check.',
    direction: 'in',
    createdAt: '2026-10-02T10:05:00.000Z',
    updatedAt: '2026-10-02T10:05:00.000Z',
  },
  {
    id: 'e5000000-0000-4000-8000-000000000004',
    invoiceId: FA_ATLAS,
    invoiceNumber: 'FA-2026-0001',
    partnerId: ATLAS,
    partnerName: 'Atlas Digital',
    date: '2026-10-05',
    amount: 2407.5,
    mode: 'transfer',
    reference: 'VIR-20114',
    currency: 'USD',
    notes: 'Consulting days settled.',
    direction: 'out',
    createdAt: '2026-10-05T15:20:00.000Z',
    updatedAt: '2026-10-05T15:20:00.000Z',
  },
  {
    id: 'e5000000-0000-4000-8000-000000000005',
    invoiceId: FA_NORD,
    invoiceNumber: 'FA-2026-0002',
    partnerId: NORD,
    partnerName: 'Nord Industries',
    date: '2026-10-22',
    amount: 500,
    mode: 'check',
    reference: 'CHQ-20611',
    currency: 'USD',
    notes: 'First payment on the mouse + paper bill.',
    direction: 'out',
    createdAt: '2026-10-22T09:45:00.000Z',
    updatedAt: '2026-10-22T09:45:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly items = signal<Payment[]>(SEED_PAYMENTS);
  private readonly invoices = inject(InvoiceService);

  getPayments(query: PaymentQuery): Observable<Page<Payment>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getPayment(id: string): Observable<Payment | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((payment) => payment.id === id)));
  }

  createPayment(input: PaymentInput): Observable<Payment> {
    if (!(input.amount > 0)) return this.fail('invalidAmount');

    return this.invoices.getInvoice(input.invoiceId).pipe(
      switchMap((invoice) => {
        if (!invoice) return this.fail('invoiceNotFound');
        if (invoice.kind !== 'invoice' || invoice.status !== 'posted') {
          return this.fail('invoiceNotPosted');
        }

        const { due } = invoiceTotals(invoice);
        if (input.amount > due) return this.fail('overpaid');

        return this.invoices.addPayment(invoice.id, input.amount).pipe(
          map((updated) => {
            const created = this.toPayment(input, updated);
            this.items.update((list) => [...list, created]);
            return created;
          }),
        );
      }),
    );
  }

  /**
   * Records a payment we owe to a supplier (direction 'out'). The caller
   * (SupplierBillService) validates the bill state before calling — the
   * overpayment guard lives there, like the invoice guard does here.
   */
  createOutPayment(bill: SupplierBillPayer, input: PaymentInput): Observable<Payment> {
    if (!(input.amount > 0)) return this.fail('invalidAmount');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const now = new Date().toISOString();
        const created: Payment = {
          id: this.newId(),
          invoiceId: bill.id,
          invoiceNumber: bill.number,
          partnerId: bill.supplierId,
          partnerName: bill.supplierName,
          date: input.date,
          amount: input.amount,
          mode: input.mode,
          reference: input.reference.trim(),
          currency: bill.currency,
          notes: input.notes.trim(),
          direction: 'out',
          createdAt: now,
          updatedAt: now,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  /** Mock technique: a derived computation (bill state) reads the list directly. */
  allPayments(): Payment[] {
    return this.items();
  }

  /** All payments of one document (invoice or supplier bill), newest first. */
  getPaymentsByDoc(docId: string): Observable<Payment[]> {
    return timer(LATENCY_MS).pipe(
      map(() =>
        this.items()
          .filter((payment) => payment.invoiceId === docId)
          .sort((a, b) => b.date.localeCompare(a.date)),
      ),
    );
  }

  private toPayment(input: PaymentInput, invoice: Invoice): Payment {
    const now = new Date().toISOString();
    return {
      id: this.newId(),
      invoiceId: invoice.id,
      invoiceNumber: invoice.number ?? '',
      partnerId: invoice.customerId,
      partnerName: invoice.customerSnapshot?.name ?? '',
      date: input.date,
      amount: input.amount,
      mode: input.mode,
      reference: input.reference.trim(),
      currency: invoice.currency,
      notes: input.notes.trim(),
      direction: 'in',
      createdAt: now,
      updatedAt: now,
    };
  }

  private buildPage(query: PaymentQuery): Page<Payment> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((payment) => {
      if (query.mode && payment.mode !== query.mode) return false;
      if (query.direction && payment.direction !== query.direction) return false;
      if (query.from && payment.date < query.from) return false;
      if (query.to && payment.date > query.to) return false;
      if (search && !this.matchesSearch(payment, search)) return false;
      return true;
    });

    const sorted = this.sortPayments(filtered, query.sort);

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(payment: Payment, search: string): boolean {
    const haystack = [payment.reference, payment.partnerName, payment.invoiceNumber];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortPayments(list: Payment[], sort: string | undefined): Payment[] {
    const [field, direction] = (sort ?? 'date,desc').split(',');
    const sign = direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
      if (field === 'amount') return (a.amount - b.amount) * sign;
      return a.date.localeCompare(b.date) * sign;
    });
  }

  private fail(code: PaymentErrorCode): Observable<never> {
    return throwError(() => new PaymentError(code));
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

import { Injectable, inject, signal } from '@angular/core';
import { Observable, forkJoin, map, of, switchMap, throwError, timer } from 'rxjs';
import { Partner } from '../../crm/models/partner';
import { PartnerService } from '../../crm/services/partner.service';
import { Page } from '../../../shared/models/page';
import { todayIso } from '../../../shared/utils/money';
import { Invoice, InvoiceDraftInput } from '../../invoices/models/invoice';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { dueDateFrom } from '../../invoices/utils/invoice-calc';
import { InvoicingSettingsService } from '../../invoicing/services/invoicing-settings.service';
import { Product } from '../../products/models/product';
import { ProductService } from '../../products/services/product.service';
import {
  CustomerSnapshot,
  SalesDraftInput,
  SalesLine,
  SalesLineInput,
  SalesOrder,
  SalesQuery,
  SalesSummary,
  SALES_NUMBER_PREFIX,
} from '../models/sales-order';
import { isLate, salesNumber } from '../utils/sales-calc';

const LATENCY_MS = 300;

export type SalesErrorCode =
  | 'notFound'
  | 'notDraft'
  | 'notConfirmed'
  | 'noLines'
  | 'missingCustomer'
  | 'expectedDateBeforeOrder'
  | 'hasInvoice'
  | 'hasDelivery'
  | 'notQuote'
  | 'quoteAlreadyConverted';

export class SalesError extends Error {
  constructor(readonly code: SalesErrorCode) {
    super(code);
  }
}

const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const HORIZON = 'f4a1c2e0-8a01-4a10-9d21-000000000006';
const THERMES = 'f4a1c2e0-8a01-4a10-9d21-000000000008';

const LAPTOP = 'a1000000-0000-4000-8000-000000000001';
const MOUSE = 'a1000000-0000-4000-8000-000000000002';
const DOCK = 'a1000000-0000-4000-8000-000000000003';
const CONSULT = 'a1000000-0000-4000-8000-000000000007';
const PAPER = 'a1000000-0000-4000-8000-000000000008';
const TONER = 'a1000000-0000-4000-8000-000000000009';

function line(
  id: string,
  productId: string,
  reference: string,
  description: string,
  unit: string,
  quantity: number,
  unitPrice: number,
  vatRate: number,
): SalesLine {
  return {
    id,
    productId,
    reference,
    description,
    unit,
    quantity,
    unitPrice,
    discountPct: 0,
    vatRate,
  };
}

const SEED_ORDERS: SalesOrder[] = [
  {
    id: 'e5000000-0000-4000-8000-000000000001',
    number: null,
    status: 'draft',
    customerId: ACME,
    customerSnapshot: null,
    orderDate: '2026-10-21',
    expectedDate: '2026-11-04',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [
      line('sl-1001', MOUSE, 'SKU-1002', 'Wireless Mouse', 'piece', 40, 25, 19),
      line('sl-1002', TONER, 'SKU-3002', 'Toner Cartridge', 'piece', 10, 95, 19),
    ],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-10-21T09:00:00.000Z',
    updatedAt: '2026-10-21T09:00:00.000Z',
    confirmedAt: null,
    cancelledAt: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000002',
    number: 'CMD-2026-0001',
    status: 'confirmed',
    customerId: GLOBAL,
    customerSnapshot: {
      name: 'Global Ltd',
      taxId: '09876543/B/M/000',
      address: '5 Bishopsgate, London, GB',
    },
    orderDate: '2026-10-12',
    expectedDate: '2026-10-28',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [line('sl-1003', LAPTOP, 'SKU-1001', 'Laptop Pro 14', 'piece', 4, 1450, 19)],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:10:00.000Z',
    confirmedAt: '2026-10-12T10:10:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000003',
    number: 'CMD-2026-0002',
    status: 'confirmed',
    customerId: ATLAS,
    customerSnapshot: {
      name: 'Atlas Digital',
      taxId: '08812345/A/M/000',
      address: '12 Rue du Lac Léman, Tunis, TN',
    },
    orderDate: '2026-09-15',
    expectedDate: '2026-10-15',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: 'Customer asked for an urgent delivery.',
    lines: [line('sl-1004', DOCK, 'SKU-1003', 'USB-C Docking Station', 'piece', 6, 199, 19)],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-15T08:40:00.000Z',
    confirmedAt: '2026-09-15T08:40:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000004',
    number: 'CMD-2026-0003',
    status: 'confirmed',
    customerId: HORIZON,
    customerSnapshot: {
      name: 'Horizon Media',
      taxId: '22334455/D/M/000',
      address: '450 Broadway, New York, US',
    },
    orderDate: '2026-09-20',
    expectedDate: '2026-10-20',
    paymentTerms: 'net60',
    currency: 'USD',
    notes: '',
    lines: [
      line('sl-1005', MOUSE, 'SKU-1002', 'Wireless Mouse', 'piece', 50, 25, 19),
      line('sl-1006', PAPER, 'SKU-3001', 'Printer Paper A4', 'box', 20, 12, 7),
    ],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-09-20T09:05:00.000Z',
    confirmedAt: '2026-09-20T09:05:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000005',
    number: 'CMD-2026-0004',
    status: 'confirmed',
    customerId: THERMES,
    customerSnapshot: {
      name: 'Societe des Thermes',
      taxId: '04455667/F/M/000',
      address: 'Avenue Haffouz, Sousse, TN',
    },
    orderDate: '2026-08-25',
    expectedDate: '2026-09-30',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [line('sl-1007', CONSULT, 'SKU-2003', 'Consulting Day', 'day', 5, 650, 7)],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-08-25T10:00:00.000Z',
    updatedAt: '2026-08-25T10:05:00.000Z',
    confirmedAt: '2026-08-25T10:05:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'e5000000-0000-4000-8000-000000000006',
    number: null,
    status: 'cancelled',
    customerId: ACME,
    customerSnapshot: null,
    orderDate: '2026-10-01',
    expectedDate: '2026-10-21',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: 'Customer cancelled, needs were covered by the existing contract.',
    lines: [line('sl-1008', DOCK, 'SKU-1003', 'USB-C Docking Station', 'piece', 2, 199, 19)],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-09T15:00:00.000Z',
    confirmedAt: null,
    cancelledAt: '2026-10-09T15:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class SalesOrderService {
  private readonly items = signal<SalesOrder[]>(SEED_ORDERS);
  private readonly partners = inject(PartnerService);
  private readonly invoices = inject(InvoiceService);
  private readonly products = inject(ProductService);
  private readonly invoicingSettings = inject(InvoicingSettingsService);

  getOrders(query: SalesQuery): Observable<Page<SalesOrder>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getOrder(id: string): Observable<SalesOrder | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((order) => order.id === id)));
  }

  getSummary(): Observable<SalesSummary> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        let awaiting = 0;
        let late = 0;

        for (const order of this.items()) {
          if (order.status !== 'confirmed') continue;
          if (order.invoiceId !== null) continue;
          awaiting += 1;
          if (isLate(order)) late += 1;
        }

        return { awaiting, late };
      }),
    );
  }

  getOrderByQuote(quoteId: string): Observable<SalesOrder | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => this.items().find((order) => order.originQuoteId === quoteId)),
    );
  }

  getOrderByInvoice(invoiceId: string): Observable<SalesOrder | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => this.items().find((order) => order.invoiceId === invoiceId)),
    );
  }

  linkDelivery(orderId: string, deliveryId: string): void {
    const existing = this.items().find((order) => order.id === orderId);
    if (!existing) return;
    this.replace({ ...existing, deliveryNoteId: deliveryId });
  }

  linkInvoice(orderId: string, invoiceId: string): void {
    const existing = this.items().find((order) => order.id === orderId);
    if (!existing) return;
    this.replace({ ...existing, invoiceId, updatedAt: new Date().toISOString() });
  }

  clearInvoiceLink(orderId: string): void {
    const existing = this.items().find((order) => order.id === orderId);
    if (!existing) return;
    this.replace({ ...existing, invoiceId: null });
  }

  convertQuoteToOrder(quoteId: string): Observable<SalesOrder> {
    return this.invoices.getInvoice(quoteId).pipe(
      switchMap((quote) => {
        if (!quote) return this.fail('notFound');
        if (quote.kind !== 'quote') return this.fail('notQuote');
        if (quote.status !== 'posted') return this.fail('notDraft');
        if (this.items().some((order) => order.originQuoteId === quote.id)) {
          return this.fail('quoteAlreadyConverted');
        }

        const today = todayIso();
        const input: SalesDraftInput = {
          id: null,
          customerId: quote.customerId,
          orderDate: today,
          expectedDate: today,
          paymentTerms: quote.paymentTerms,
          currency: quote.currency,
          notes: quote.notes,
          lines: [],
        };

        return this.withQuoteLines(quote, (lines) => ({ ...input, lines })).pipe(
          switchMap((draft) => this.saveDraft(draft)),
          map((created) => {
            const linked: SalesOrder = { ...created, originQuoteId: quote.id };
            this.replace(linked);
            return linked;
          }),
        );
      }),
    );
  }

  saveDraft(data: SalesDraftInput): Observable<SalesOrder> {
    const invalid = this.validateDraft(data);
    if (invalid) return this.fail(invalid);

    const existing = data.id ? this.items().find((order) => order.id === data.id) : undefined;
    if (data.id) {
      if (!existing) return this.fail('notFound');
      if (existing.status !== 'draft') return this.fail('notDraft');
    }

    return this.withCustomer(data.customerId, (partner) => {
      const now = new Date().toISOString();

      if (existing) {
        const updated: SalesOrder = {
          ...existing,
          customerId: data.customerId,
          orderDate: data.orderDate,
          expectedDate: data.expectedDate,
          paymentTerms: data.paymentTerms,
          currency: data.currency,
          notes: data.notes,
          lines: data.lines.map((item) => ({ id: this.newId(), ...item })),
          updatedAt: now,
        };
        this.replace(updated);
        return updated;
      }

      const created: SalesOrder = {
        id: this.newId(),
        number: null,
        status: 'draft',
        customerId: data.customerId,
        customerSnapshot: null,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate,
        paymentTerms: data.paymentTerms,
        currency: data.currency,
        notes: data.notes,
        lines: data.lines.map((item) => ({ id: this.newId(), ...item })),
        invoiceId: null,
        deliveryNoteId: null,
        originQuoteId: null,
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        cancelledAt: null,
      };
      this.items.update((list) => [...list, created]);
      return created;
    });
  }

  confirmOrder(id: string): Observable<SalesOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'draft') return this.fail('notDraft');
    if (existing.lines.length === 0) return this.fail('noLines');
    if (!existing.customerId) return this.fail('missingCustomer');

    return this.withCustomer(existing.customerId, (partner) => {
      const now = new Date().toISOString();
      const confirmed: SalesOrder = {
        ...existing,
        number: this.nextNumber(existing.orderDate),
        status: 'confirmed',
        customerSnapshot: toSnapshot(partner),
        confirmedAt: now,
        updatedAt: now,
      };
      this.replace(confirmed);
      return confirmed;
    });
  }

  cancelOrder(id: string): Observable<SalesOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'confirmed') return this.fail('notConfirmed');
    if (existing.invoiceId !== null) return this.fail('hasInvoice');
    if (existing.deliveryNoteId !== null) return this.fail('hasDelivery');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const cancelled: SalesOrder = {
          ...existing,
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.replace(cancelled);
        return cancelled;
      }),
    );
  }

  createInvoice(id: string): Observable<Invoice> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'confirmed') return this.fail('notConfirmed');
    if (existing.invoiceId !== null) return this.fail('hasInvoice');
    if (existing.deliveryNoteId !== null) return this.fail('hasDelivery');

    const today = todayIso();
    const input: InvoiceDraftInput = {
      id: null,
      kind: 'invoice',
      customerId: existing.customerId,
      issueDate: today,
      dueDate: dueDateFrom(today, existing.paymentTerms),
      paymentTerms: existing.paymentTerms,
      currency: existing.currency,
      stampDuty: this.invoicingSettings.settings().defaultStampDuty,
      notes: existing.notes,
      originInvoiceId: null,
      salesOrderId: existing.id,
      deliveryNoteId: null,
      lines: existing.lines.map((orderLine) => ({
        productId: orderLine.productId,
        description: orderLine.description,
        quantity: orderLine.quantity,
        unitPrice: orderLine.unitPrice,
        discountPct: orderLine.discountPct,
        vatRate: orderLine.vatRate,
      })),
    };

    return this.invoices.saveDraft(input).pipe(
      map((invoice) => {
        const now = new Date().toISOString();
        this.replace({ ...existing, invoiceId: invoice.id, updatedAt: now });
        return invoice;
      }),
    );
  }

  deleteDraft(id: string): Observable<void> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'draft') return this.fail('notDraft');

    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => list.filter((order) => order.id !== id));
      }),
    );
  }

  private validateDraft(data: SalesDraftInput): SalesErrorCode | null {
    if (data.lines.length === 0) return 'noLines';
    if (!data.customerId) return 'missingCustomer';
    if (data.expectedDate < data.orderDate) return 'expectedDateBeforeOrder';
    return null;
  }

  private withCustomer<T>(customerId: string, next: (partner: Partner) => T): Observable<T> {
    return this.partners.getPartner(customerId).pipe(
      switchMap((partner) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            if (!partner) throw new SalesError('missingCustomer');
            return next(partner);
          }),
        ),
      ),
    );
  }

  private withQuoteLines<T>(
    quote: Invoice,
    next: (lines: SalesLineInput[]) => T,
  ): Observable<T> {
    const lookups = quote.lines.map((line) =>
      line.productId ? this.products.getProduct(line.productId) : of(undefined),
    );

    return forkJoin(lookups).pipe(
      map((found) =>
        next(
          quote.lines.map((line, index) => {
            const product: Product | undefined = found[index];
            return {
              productId: line.productId,
              reference: product?.sku ?? '',
              description: line.description,
              unit: product?.unit ?? 'piece',
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountPct: line.discountPct,
              vatRate: line.vatRate,
            };
          }),
        ),
      ),
    );
  }

  private fail(code: SalesErrorCode): Observable<never> {
    return throwError(() => new SalesError(code));
  }

  private replace(updated: SalesOrder): void {
    this.items.update((list) => list.map((order) => (order.id === updated.id ? updated : order)));
  }

  private nextNumber(orderDate: string): string {
    const year = orderDate.slice(0, 4);
    let sequence = 0;

    for (const order of this.items()) {
      if (!order.number) continue;
      const [prefixPart, yearPart, sequencePart] = order.number.split('-');
      if (prefixPart !== SALES_NUMBER_PREFIX || yearPart !== year) continue;
      const value = Number(sequencePart);
      if (Number.isFinite(value) && value > sequence) sequence = value;
    }

    return salesNumber(Number(year), sequence + 1);
  }

  private buildPage(query: SalesQuery): Page<SalesOrder> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((order) => {
      if (query.status && order.status !== query.status) return false;
      if (query.customerId && order.customerId !== query.customerId) return false;
      if (search && !this.matchesSearch(order, search)) return false;
      return true;
    });

    const sorted = this.sortOrders(filtered, query.sort);

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(order: SalesOrder, search: string): boolean {
    const haystack = [order.number ?? '', order.customerSnapshot?.name ?? ''];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortOrders(list: SalesOrder[], sort: string | undefined): SalesOrder[] {
    const [field, direction] = (sort ?? 'orderDate,desc').split(',');
    const sign = direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
      if (field === 'expectedDate') return a.expectedDate.localeCompare(b.expectedDate) * sign;
      return a.orderDate.localeCompare(b.orderDate) * sign;
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

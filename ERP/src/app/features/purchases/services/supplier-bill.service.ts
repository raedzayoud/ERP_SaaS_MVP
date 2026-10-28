import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { PartnerService } from '../../crm/services/partner.service';
import { Payment, PaymentInput } from '../../payments/models/payment';
import { PaymentService } from '../../payments/services/payment.service';
import { todayIso } from '../../../shared/utils/money';
import { PurchaseLine, PurchaseOrder, SupplierSnapshot } from '../models/purchase-order';
import { receptionState } from '../utils/purchase-calc';
import { PurchaseService } from './purchase.service';
import {
  BillFromOrderInput,
  BillLine,
  BillLineInput,
  BillState,
  SupplierBill,
  SupplierBillInput,
  SupplierBillQuery,
} from '../models/supplier-bill';
import { billNumber, billState, billTotals } from '../utils/supplier-bill-calc';

const LATENCY_MS = 150;

export class SupplierBillError extends Error {
  readonly code: SupplierBillErrorCode;

  constructor(code: SupplierBillErrorCode) {
    super(code);
    this.code = code;
    this.name = 'SupplierBillError';
  }
}

export type SupplierBillErrorCode =
  | 'notFound'
  | 'notConfirmed'
  | 'nothingReceived'
  | 'orderAlreadyBilled'
  | 'noLines'
  | 'missingSupplier'
  | 'dueDateBeforeBilling'
  | 'hasPayments'
  | 'overpaid';

const FA_ATLAS = 'f7000000-0000-4000-8000-000000000001';
const FA_NORD = 'f7000000-0000-4000-8000-000000000002';
const FA_NORD_FREIGHT = 'f7000000-0000-4000-8000-000000000003';
const FA_DELTA = 'f7000000-0000-4000-8000-000000000004';

const ORDER_ATLAS = 'd4000000-0000-4000-8000-000000000005';
const ORDER_NORD = 'd4000000-0000-4000-8000-000000000004';
const NORD = 'f4a1c2e0-8a01-4a10-9d21-000000000003';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const DELTA = 'f4a1c2e0-8a01-4a10-9d21-000000000005';

const NORD_SNAPSHOT: SupplierSnapshot = {
  name: 'Nord Industries',
  taxId: '78-3345678',
  address: 'Wiener Strasse 12, Berlin, DE',
};
const ATLAS_SNAPSHOT: SupplierSnapshot = {
  name: 'Atlas Digital',
  taxId: '08812345/A/M/000',
  address: '12 Rue du Lac Léman, Tunis, TN',
};
const DELTA_SNAPSHOT: SupplierSnapshot = {
  name: 'Delta Logistics',
  taxId: '11998877/C/M/000',
  address: '8 Quai Perrache, Lyon, FR',
};

function billLine(
  lineId: string,
  productId: string | null,
  reference: string,
  description: string,
  unit: string,
  quantity: number,
  unitCost: number,
  vatRate: number,
): BillLine {
  return { lineId, productId, reference, description, unit, quantity, unitCost, vatRate };
}

function standaloneLine(line: BillLineInput, index: number): BillLine {
  return { lineId: `bill-l${index + 1}`, ...line };
}

const SEED_BILLS: SupplierBill[] = [
  {
    id: FA_ATLAS,
    number: 'FA-2026-0001',
    sourceType: 'order',
    orderId: ORDER_ATLAS,
    orderNumber: 'BC-2026-0004',
    supplierId: ATLAS,
    supplierSnapshot: ATLAS_SNAPSHOT,
    billingDate: '2026-10-02',
    dueDate: '2026-11-01',
    currency: 'USD',
    notes: 'Consulting days delivered in September.',
    lines: [billLine('bl-101', null, 'SKU-2003', 'Consulting Day', 'day', 5, 450, 7)],
    createdAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-05T15:20:00.000Z',
  },
  {
    id: FA_NORD,
    number: 'FA-2026-0002',
    sourceType: 'order',
    orderId: ORDER_NORD,
    orderNumber: 'BC-2026-0003',
    supplierId: NORD,
    supplierSnapshot: NORD_SNAPSHOT,
    billingDate: '2026-10-19',
    dueDate: '2026-10-20',
    currency: 'USD',
    notes: 'Partial: 35 mice and 20 boxes of paper received.',
    lines: [
      billLine('bl-201', null, 'SKU-1002', 'Wireless Mouse', 'piece', 35, 15, 19),
      billLine('bl-202', null, 'SKU-3001', 'Printer Paper A4', 'box', 20, 8, 7),
    ],
    createdAt: '2026-10-19T10:00:00.000Z',
    updatedAt: '2026-10-22T09:45:00.000Z',
  },
  {
    id: FA_NORD_FREIGHT,
    number: 'FA-2026-0003',
    sourceType: 'standalone',
    orderId: null,
    orderNumber: null,
    supplierId: NORD,
    supplierSnapshot: NORD_SNAPSHOT,
    billingDate: '2026-09-20',
    dueDate: '2026-09-25',
    currency: 'USD',
    notes: 'Freight and handling on the October delivery.',
    lines: [billLine('bl-301', null, 'FRT-01', 'Freight + handling', 'service', 1, 128.4, 0)],
    createdAt: '2026-10-21T11:00:00.000Z',
    updatedAt: '2026-10-21T11:00:00.000Z',
  },
  {
    id: FA_DELTA,
    number: 'FA-2026-0004',
    sourceType: 'standalone',
    orderId: null,
    orderNumber: null,
    supplierId: DELTA,
    supplierSnapshot: DELTA_SNAPSHOT,
    billingDate: '2026-10-24',
    dueDate: '2026-11-23',
    currency: 'USD',
    notes: '',
    lines: [billLine('bl-401', null, 'SKU-1003', 'USB-C Docking Station', 'piece', 2, 120, 19)],
    createdAt: '2026-10-24T14:30:00.000Z',
    updatedAt: '2026-10-24T14:30:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class SupplierBillService {
  private counter = 0;

  private readonly items = signal<SupplierBill[]>(SEED_BILLS);
  private readonly partners = inject(PartnerService);
  private readonly orders = inject(PurchaseService);
  private readonly payments = inject(PaymentService);

  getBills(query: SupplierBillQuery): Observable<Page<SupplierBill>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getBill(id: string): Observable<SupplierBill | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((bill) => bill.id === id)));
  }

  /** Issues a bill from the received quantities of a confirmed order. */
  createFromOrder(input: BillFromOrderInput): Observable<SupplierBill> {
    return this.orders.getOrder(input.orderId).pipe(
      map((order) => ({ order, error: this.validateOrderForBilling(order, input) })),
      switchMap(({ order, error }) => {
        if (error || !order) return throwError(() => new SupplierBillError(error ?? 'notFound'));
        return this.saveBuildFromOrder(order, input);
      }),
    );
  }

  /** Creates an unpaid standalone bill (free lines written by the buyer). */
  saveDraft(input: SupplierBillInput): Observable<SupplierBill> {
    const error = this.validateDraft(input);
    if (error) return this.fail(error);

    return this.withSupplier(input.supplierId).pipe(
      map((snapshot) => {
        if (!snapshot) throw new SupplierBillError('missingSupplier');

        const now = new Date().toISOString();
        const created: SupplierBill = {
          id: this.newId(),
          number: this.nextNumber(input.billingDate),
          sourceType: 'standalone',
          orderId: null,
          orderNumber: null,
          supplierId: input.supplierId,
          supplierSnapshot: snapshot,
          billingDate: input.billingDate,
          dueDate: input.dueDate,
          currency: 'USD',
          notes: input.notes.trim(),
          lines: input.lines.map(standaloneLine),
          createdAt: now,
          updatedAt: now,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  /** Records a supplier payment ('out' direction). Overpayment is refused. */
  addPayment(billId: string, input: PaymentInput): Observable<Payment> {
    const bill = this.items().find((item) => item.id === billId);
    if (!bill) return this.fail('notFound');

    const { totalTtc } = billTotals(bill.lines, bill.currency);
    const remaining = totalTtc - this.paidOf(bill);
    if (input.amount > remaining + 0.005) return this.fail('overpaid');

    return this.payments.createOutPayment(
      {
        id: bill.id,
        number: bill.number,
        supplierId: bill.supplierId,
        supplierName: bill.supplierSnapshot?.name ?? '',
        currency: bill.currency,
      },
      { ...input, invoiceId: bill.id },
    );
  }

  deleteBill(id: string): Observable<null> {
    const bill = this.items().find((item) => item.id === id);
    if (!bill) return this.fail('notFound');
    if (this.paidOf(bill) > 0) return this.fail('hasPayments');

    this.items.update((list) => list.filter((item) => item.id !== id));
    return timer(LATENCY_MS).pipe(map(() => null));
  }

  /** Confirmed orders with a reception that do not have a bill yet. */
  billableOrders(): Observable<Array<Pick<PurchaseOrder, 'id' | 'number'>>> {
    return timer(LATENCY_MS).pipe(
      map(() =>
        this.orders
          .allOrders()
          .filter(
            (order) =>
              order.status === 'confirmed' &&
              receptionState(order.lines) !== 'none' &&
              !this.items().some((bill) => bill.orderId === order.id),
          )
          .map((order) => ({ id: order.id, number: order.number })),
      ),
    );
  }

  /** True when a bill was already issued for an order (one bill per order). */
  hasBillFor(orderId: string): boolean {
    return this.items().some((bill) => bill.orderId === orderId);
  }

  /** Mock technique: reports read the bills snapshot synchronously. */
  allBills(): SupplierBill[] {
    return this.items();
  }

  totalOf(bill: SupplierBill): ReturnType<typeof billTotals> {
    return billTotals(bill.lines, bill.currency);
  }

  paidOf(bill: SupplierBill): number {
    return this.payments
      .allPayments()
      .filter((payment) => payment.invoiceId === bill.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  stateOf(bill: SupplierBill): BillState {
    return billState(this.paidOf(bill), billTotals(bill.lines, bill.currency).totalTtc);
  }

  outstandingOf(bill: SupplierBill): number {
    return billTotals(bill.lines, bill.currency).totalTtc - this.paidOf(bill);
  }

  overdue(bill: SupplierBill): boolean {
    return this.stateOf(bill) !== 'paid' && bill.dueDate < todayIso();
  }

  private validateOrderForBilling(
    order: PurchaseOrder | undefined,
    input: BillFromOrderInput,
  ): SupplierBillErrorCode | null {
    if (!order) return 'notFound';
    if (order.status !== 'confirmed' || !order.supplierSnapshot) return 'notConfirmed';
    if (receptionState(order.lines) === 'none') return 'nothingReceived';
    if (this.items().some((bill) => bill.orderId === order.id)) return 'orderAlreadyBilled';
    if (input.dueDate < input.billingDate) return 'dueDateBeforeBilling';
    return null;
  }

  private validateDraft(input: SupplierBillInput): SupplierBillErrorCode | null {
    if (!input.supplierId) return 'missingSupplier';
    if (input.lines.length === 0) return 'noLines';
    if (input.dueDate < input.billingDate) return 'dueDateBeforeBilling';
    return null;
  }

  private saveBuildFromOrder(order: PurchaseOrder, input: BillFromOrderInput): Observable<SupplierBill> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const lines: BillLine[] = order.lines
          .map((line) => this.toBillLine(line))
          .filter((line): line is BillLine => line !== null);
        if (lines.length === 0) throw new SupplierBillError('nothingReceived');

        const now = new Date().toISOString();
        const created: SupplierBill = {
          id: this.newId(),
          number: this.nextNumber(input.billingDate),
          sourceType: 'order',
          orderId: order.id,
          orderNumber: order.number,
          supplierId: order.supplierId,
          supplierSnapshot: order.supplierSnapshot,
          billingDate: input.billingDate,
          dueDate: input.dueDate,
          currency: order.currency,
          notes: input.notes.trim(),
          lines,
          createdAt: now,
          updatedAt: now,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  /** Maps an order line to a bill line for the part that was received. */
  private toBillLine(line: PurchaseLine): BillLine | null {
    if (line.receivedQty <= 0) return null;
    return {
      lineId: this.newId(),
      productId: line.productId,
      reference: line.reference,
      description: line.description,
      unit: line.unit,
      quantity: line.receivedQty,
      unitCost: line.unitCost,
      vatRate: line.vatRate,
    };
  }

  /** Free the FA numbering: sequence of the same billing year. */
  private nextNumber(billingDate: string): string {
    const year = Number.isFinite(Number(billingDate.slice(0, 4)))
      ? Number(billingDate.slice(0, 4))
      : Number(todayIso().slice(0, 4));
    const numbers = this.items()
      .map((bill) => Number(bill.number.slice(-4)))
      .filter((value) => Number.isFinite(value));
    const sequence = numbers.length ? Math.max(...numbers) + 1 : 1;
    return billNumber(year, sequence);
  }

  private withSupplier(supplierId: string): Observable<SupplierSnapshot | null> {
    return this.partners.getPartner(supplierId).pipe(
      map((partner) => {
        if (!partner?.isSupplier) return null;
        const { street, city, country } = partner.address;
        return {
          name: partner.name,
          taxId: partner.taxId ?? '',
          address: `${street}, ${city}, ${country}`,
        };
      }),
    );
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    this.counter += 1;
    return `fa${Date.now()}-${this.counter}`;
  }

  private fail(code: SupplierBillErrorCode): Observable<never> {
    return throwError(() => new SupplierBillError(code));
  }

  private buildPage(query: SupplierBillQuery): Page<SupplierBill> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((bill) => {
      if (query.supplierId && bill.supplierId !== query.supplierId) return false;
      if (query.state && this.stateOf(bill) !== query.state) return false;
      if (search && !this.matchesSearch(bill, search)) return false;
      return true;
    });

    filtered.sort((a, b) => b.billingDate.localeCompare(a.billingDate));

    const start = query.page * size;
    return {
      items: filtered.slice(start, start + size),
      total: filtered.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(bill: SupplierBill, search: string): boolean {
    const haystack = [bill.number, bill.orderNumber ?? '', bill.supplierSnapshot?.name ?? ''].join(' ');
    return haystack.toLowerCase().includes(search);
  }
}

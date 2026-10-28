import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { Partner } from '../../crm/models/partner';
import { PartnerService } from '../../crm/services/partner.service';
import { Page } from '../../../shared/models/page';
import { addDaysIso, todayIso } from '../../../shared/utils/money';
import { StockService } from '../../stock/services/stock.service';
import {
  PurchaseDraftInput,
  PurchaseLine,
  PurchaseOrder,
  PurchaseQuery,
  PurchaseSummary,
  PURCHASE_NUMBER_PREFIX,
  ReceiveInput,
  SupplierSnapshot,
} from '../models/purchase-order';
import { canReceive, isLate, purchaseNumber, receptionState } from '../utils/purchase-calc';

const LATENCY_MS = 300;

export type PurchaseErrorCode =
  | 'notFound'
  | 'notDraft'
  | 'notConfirmed'
  | 'noLines'
  | 'missingSupplier'
  | 'expectedDateBeforeOrder'
  | 'hasReceptions'
  | 'invalidReceiveQty'
  | 'alreadyComplete'
  | 'cancelledOrder';

export class PurchaseError extends Error {
  constructor(readonly code: PurchaseErrorCode) {
    super(code);
  }
}

const NORD = 'f4a1c2e0-8a01-4a10-9d21-000000000003';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const DELTA = 'f4a1c2e0-8a01-4a10-9d21-000000000005';
const VERDE = 'f4a1c2e0-8a01-4a10-9d21-000000000007';

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
  unitCost: number,
  vatRate: number,
  receivedQty = 0,
): PurchaseLine {
  return {
    id,
    productId,
    reference,
    description,
    unit,
    quantity,
    unitCost,
    discountPct: 0,
    vatRate,
    receivedQty,
  };
}

const SEED_ORDERS: PurchaseOrder[] = [
  {
    id: 'd4000000-0000-4000-8000-000000000001',
    number: null,
    status: 'draft',
    supplierId: NORD,
    supplierSnapshot: null,
    orderDate: '2026-10-20',
    expectedDate: '2026-11-03',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [
      line('pl-1001', MOUSE, 'SKU-1002', 'Wireless Mouse', 'piece', 40, 15, 19),
      line('pl-1002', TONER, 'SKU-3002', 'Toner Cartridge', 'piece', 10, 60, 19),
    ],
    receptions: [],
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    confirmedAt: null,
    cancelledAt: null,
  },
  {
    id: 'd4000000-0000-4000-8000-000000000002',
    number: 'BC-2026-0001',
    status: 'confirmed',
    supplierId: VERDE,
    supplierSnapshot: {
      name: 'Verde Manufacturing',
      taxId: '55667788/E/M/000',
      address: '900 W Randolph St, Chicago, US',
    },
    orderDate: '2026-10-12',
    expectedDate: '2026-10-28',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [line('pl-1003', LAPTOP, 'SKU-1001', 'Laptop Pro 14', 'piece', 4, 900, 19)],
    receptions: [],
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:10:00.000Z',
    confirmedAt: '2026-10-12T10:10:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'd4000000-0000-4000-8000-000000000003',
    number: 'BC-2026-0002',
    status: 'confirmed',
    supplierId: DELTA,
    supplierSnapshot: {
      name: 'Delta Logistics',
      taxId: '11998877/C/M/000',
      address: '8 Quai Perrache, Lyon, FR',
    },
    orderDate: '2026-09-15',
    expectedDate: '2026-10-15',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: 'Supplier confirmed a delay, follow up by phone.',
    lines: [line('pl-1004', DOCK, 'SKU-1003', 'USB-C Docking Station', 'piece', 6, 120, 19)],
    receptions: [],
    createdAt: '2026-09-15T08:30:00.000Z',
    updatedAt: '2026-09-15T08:40:00.000Z',
    confirmedAt: '2026-09-15T08:40:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'd4000000-0000-4000-8000-000000000004',
    number: 'BC-2026-0003',
    status: 'confirmed',
    supplierId: NORD,
    supplierSnapshot: {
      name: 'Nord Industries',
      taxId: '78-3345678',
      address: 'Wiener Strasse 12, Berlin, DE',
    },
    orderDate: '2026-09-20',
    expectedDate: '2026-10-20',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [
      line('pl-1005', MOUSE, 'SKU-1002', 'Wireless Mouse', 'piece', 50, 15, 19, 35),
      line('pl-1006', PAPER, 'SKU-3001', 'Printer Paper A4', 'box', 20, 8, 7, 20),
    ],
    receptions: [
      {
        id: 'rc-2001',
        date: '2026-10-05',
        blNumber: 'BL-7781',
        lines: [{ lineId: 'pl-1005', quantity: 30 }],
        createdAt: '2026-10-05T14:00:00.000Z',
      },
      {
        id: 'rc-2002',
        date: '2026-10-18',
        blNumber: 'BL-7802',
        lines: [
          { lineId: 'pl-1005', quantity: 5 },
          { lineId: 'pl-1006', quantity: 20 },
        ],
        createdAt: '2026-10-18T11:30:00.000Z',
      },
    ],
    createdAt: '2026-09-20T09:00:00.000Z',
    updatedAt: '2026-10-18T11:30:00.000Z',
    confirmedAt: '2026-09-20T09:05:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'd4000000-0000-4000-8000-000000000005',
    number: 'BC-2026-0004',
    status: 'confirmed',
    supplierId: ATLAS,
    supplierSnapshot: {
      name: 'Atlas Digital',
      taxId: '08812345/A/M/000',
      address: '12 Rue du Lac Léman, Tunis, TN',
    },
    orderDate: '2026-08-25',
    expectedDate: '2026-09-30',
    paymentTerms: 'net60',
    currency: 'USD',
    notes: '',
    lines: [line('pl-1007', CONSULT, 'SKU-2003', 'Consulting Day', 'day', 5, 450, 7, 5)],
    receptions: [
      {
        id: 'rc-2003',
        date: '2026-09-28',
        blNumber: 'BL-7700',
        lines: [{ lineId: 'pl-1007', quantity: 5 }],
        createdAt: '2026-09-28T16:00:00.000Z',
      },
    ],
    createdAt: '2026-08-25T10:00:00.000Z',
    updatedAt: '2026-09-28T16:00:00.000Z',
    confirmedAt: '2026-08-25T10:05:00.000Z',
    cancelledAt: null,
  },
  {
    id: 'd4000000-0000-4000-8000-000000000006',
    number: null,
    status: 'cancelled',
    supplierId: VERDE,
    supplierSnapshot: null,
    orderDate: '2026-10-01',
    expectedDate: '2026-10-21',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: 'Cancelled, refurbished desktops no longer available.',
    lines: [line('pl-1008', DOCK, 'SKU-1003', 'USB-C Docking Station', 'piece', 2, 120, 19)],
    receptions: [],
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-09T15:00:00.000Z',
    confirmedAt: null,
    cancelledAt: '2026-10-09T15:00:00.000Z',
  },
];

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly items = signal<PurchaseOrder[]>(SEED_ORDERS);
  private readonly partners = inject(PartnerService);
  private readonly stock = inject(StockService);

  getOrders(query: PurchaseQuery): Observable<Page<PurchaseOrder>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getOrder(id: string): Observable<PurchaseOrder | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((order) => order.id === id)));
  }

  /** Mock technique: le formulaire de facture lit la liste des BC en direct. */
  allOrders(): PurchaseOrder[] {
    return this.items();
  }

  /** Copies a confirmed or draft order into a new editable draft. */
  duplicateOrder(id: string): Observable<PurchaseOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status === 'cancelled') return this.fail('cancelledOrder');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const today = todayIso();
        const created: PurchaseOrder = {
          id: this.newId(),
          number: null,
          status: 'draft',
          supplierId: existing.supplierId,
          supplierSnapshot: null,
          orderDate: today,
          expectedDate: addDaysIso(today, 14),
          paymentTerms: existing.paymentTerms,
          currency: existing.currency,
          notes: existing.notes,
          lines: existing.lines.map((item) => ({ ...item, id: this.newId(), receivedQty: 0 })),
          receptions: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          confirmedAt: null,
          cancelledAt: null,
        };
        this.items.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  getSummary(): Observable<PurchaseSummary> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        let awaiting = 0;
        let late = 0;

        for (const order of this.items()) {
          if (order.status !== 'confirmed') continue;
          if (receptionState(order.lines) === 'complete') continue;
          awaiting += 1;
          if (isLate(order)) late += 1;
        }

        return { awaiting, late };
      }),
    );
  }

  saveDraft(data: PurchaseDraftInput): Observable<PurchaseOrder> {
    const invalid = this.validateDraft(data);
    if (invalid) return this.fail(invalid);

    const existing = data.id ? this.items().find((order) => order.id === data.id) : undefined;
    if (data.id) {
      if (!existing) return this.fail('notFound');
      if (existing.status !== 'draft') return this.fail('notDraft');
    }

    return this.withSupplier(data.supplierId, (partner) => {
      const now = new Date().toISOString();

      if (existing) {
        const updated: PurchaseOrder = {
          ...existing,
          supplierId: data.supplierId,
          orderDate: data.orderDate,
          expectedDate: data.expectedDate,
          paymentTerms: data.paymentTerms,
          currency: data.currency,
          notes: data.notes,
          lines: data.lines.map((item) => ({ id: this.newId(), receivedQty: 0, ...item })),
          updatedAt: now,
        };
        this.replace(updated);
        return updated;
      }

      const created: PurchaseOrder = {
        id: this.newId(),
        number: null,
        status: 'draft',
        supplierId: data.supplierId,
        supplierSnapshot: null,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate,
        paymentTerms: data.paymentTerms,
        currency: data.currency,
        notes: data.notes,
        lines: data.lines.map((item) => ({ id: this.newId(), receivedQty: 0, ...item })),
        receptions: [],
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        cancelledAt: null,
      };
      this.items.update((list) => [...list, created]);
      return created;
    });
  }

  confirmOrder(id: string): Observable<PurchaseOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'draft') return this.fail('notDraft');
    if (existing.lines.length === 0) return this.fail('noLines');
    if (!existing.supplierId) return this.fail('missingSupplier');

    return this.withSupplier(existing.supplierId, (partner) => {
      const now = new Date().toISOString();
      const confirmed: PurchaseOrder = {
        ...existing,
        number: this.nextNumber(existing.orderDate),
        status: 'confirmed',
        supplierSnapshot: toSnapshot(partner),
        confirmedAt: now,
        updatedAt: now,
      };
      this.replace(confirmed);
      return confirmed;
    });
  }

  cancelOrder(id: string): Observable<PurchaseOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'confirmed') return this.fail('notConfirmed');
    if (existing.receptions.length > 0) return this.fail('hasReceptions');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const cancelled: PurchaseOrder = {
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

  receiveOrder(id: string, input: ReceiveInput): Observable<PurchaseOrder> {
    const existing = this.items().find((order) => order.id === id);
    if (!existing) return this.fail('notFound');
    if (existing.status !== 'confirmed') return this.fail('notConfirmed');
    if (receptionState(existing.lines) === 'complete') return this.fail('alreadyComplete');

    const invalid = input.items.some((item) => {
      const orderLine = existing.lines.find((l) => l.id === item.lineId);
      return !orderLine || !canReceive(orderLine, item.quantity);
    });
    if (invalid || input.items.length === 0) return this.fail('invalidReceiveQty');

    return timer(LATENCY_MS).pipe(
      map(() => {
        const now = new Date().toISOString();
        const received = existing.lines.map((orderLine) => {
          const item = input.items.find((i) => i.lineId === orderLine.id);
          return item
            ? { ...orderLine, receivedQty: orderLine.receivedQty + item.quantity }
            : orderLine;
        });

        const updated: PurchaseOrder = {
          ...existing,
          lines: received,
          receptions: [
            ...existing.receptions,
            {
              id: this.newId(),
              date: input.date,
              blNumber: input.blNumber,
              lines: input.items.map((item) => ({ ...item })),
              createdAt: now,
            },
          ],
          updatedAt: now,
        };
        this.replace(updated);
        return updated;
      }),
      switchMap((updated) => {
        const items = input.items.map((item) => {
          const orderLine = existing.lines.find((l) => l.id === item.lineId);
          return { productId: orderLine?.productId ?? '', quantity: item.quantity };
        });

        return this.stock
          .recordPurchaseReception({
            refId: updated.id,
            date: input.date,
            warehouseId: input.warehouseId,
            blNumber: input.blNumber,
            items,
          })
          .pipe(map(() => updated));
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

  private validateDraft(data: PurchaseDraftInput): PurchaseErrorCode | null {
    if (data.lines.length === 0) return 'noLines';
    if (!data.supplierId) return 'missingSupplier';
    if (data.expectedDate < data.orderDate) return 'expectedDateBeforeOrder';
    return null;
  }

  private withSupplier<T>(supplierId: string, next: (partner: Partner) => T): Observable<T> {
    return this.partners.getPartner(supplierId).pipe(
      switchMap((partner) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            if (!partner) throw new PurchaseError('missingSupplier');
            return next(partner);
          }),
        ),
      ),
    );
  }

  private fail(code: PurchaseErrorCode): Observable<never> {
    return throwError(() => new PurchaseError(code));
  }

  private replace(updated: PurchaseOrder): void {
    this.items.update((list) => list.map((order) => (order.id === updated.id ? updated : order)));
  }

  private nextNumber(orderDate: string): string {
    const year = orderDate.slice(0, 4);
    let sequence = 0;

    for (const order of this.items()) {
      if (!order.number) continue;
      const [prefixPart, yearPart, sequencePart] = order.number.split('-');
      if (prefixPart !== PURCHASE_NUMBER_PREFIX || yearPart !== year) continue;
      const value = Number(sequencePart);
      if (Number.isFinite(value) && value > sequence) sequence = value;
    }

    return purchaseNumber(Number(year), sequence + 1);
  }

  private buildPage(query: PurchaseQuery): Page<PurchaseOrder> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((order) => {
      if (query.status && order.status !== query.status) return false;
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

  private matchesSearch(order: PurchaseOrder, search: string): boolean {
    const haystack = [order.number ?? '', order.supplierSnapshot?.name ?? ''];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortOrders(list: PurchaseOrder[], sort: string | undefined): PurchaseOrder[] {
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

function toSnapshot(partner: Partner): SupplierSnapshot {
  const { street, city, country } = partner.address;
  return { name: partner.name, taxId: partner.taxId, address: `${street}, ${city}, ${country}` };
}

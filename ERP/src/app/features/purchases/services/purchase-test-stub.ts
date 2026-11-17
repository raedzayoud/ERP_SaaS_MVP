import { Provider } from '@angular/core';
import { Observable, map, of, throwError } from 'rxjs';
import { Page } from '../../../shared/models/page';
import {
  PurchaseDraftInput,
  PurchaseOrder,
  PurchaseQuery,
  PurchaseSummary,
  ReceiveInput,
} from '../models/purchase-order';
import { PurchaseError, PurchaseErrorCode, PurchaseService } from './purchase.service';
import { canReceive, isLate, receptionState } from '../utils/purchase-calc';

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
): PurchaseOrder['lines'][number] {
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

/**
 * The demo purchase orders the mock features (accounting, reports) still read.
 * The application itself reads the real API.
 */
export const TEST_ORDERS: PurchaseOrder[] = [
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
    updatedAt: '2026-09-28T10:05:00.000Z',
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

/**
 * The purchase orders as a test double: the specs of the mock features
 * (accounting, reports, supplier bills) read them without the API.
 */
export function createPurchaseStub() {
  const items: PurchaseOrder[] = TEST_ORDERS.map((order) => ({ ...order }));

  const replace = (updated: PurchaseOrder): void => {
    const index = items.findIndex((order) => order.id === updated.id);
    if (index >= 0) items[index] = updated;
    else items.push(updated);
  };

  const fail = (code: PurchaseErrorCode): Observable<never> =>
    throwError(() => new PurchaseError(code));

  const newId = (): string => `d${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  return {
    getOrders: (query: PurchaseQuery): Observable<Page<PurchaseOrder>> => {
      const search = query.search?.trim().toLowerCase();
      const filtered = items.filter(
        (order) =>
          (query.status === undefined || order.status === query.status) &&
          (!search ||
            (order.number ?? '').toLowerCase().includes(search) ||
            (order.supplierSnapshot?.name ?? '').toLowerCase().includes(search)),
      );
      return of({
        items: filtered.slice(query.page * query.size, query.page * query.size + query.size),
        total: filtered.length,
        page: query.page,
        size: query.size,
      });
    },

    getOrder: (id: string): Observable<PurchaseOrder | undefined> =>
      of(items.find((order) => order.id === id)),

    getSummary: (): Observable<PurchaseSummary> => {
      let awaiting = 0;
      let late = 0;
      for (const order of items) {
        if (order.status !== 'confirmed') continue;
        if (receptionState(order.lines) === 'complete') continue;
        awaiting += 1;
        if (isLate(order)) late += 1;
      }
      return of({ awaiting, late });
    },

    saveDraft: (data: PurchaseDraftInput): Observable<PurchaseOrder> => {
      const existing = data.id ? items.find((order) => order.id === data.id) : undefined;
      if (data.id && !existing) return fail('notFound');
      if (existing && existing.status !== 'draft') return fail('notDraft');
      if (data.lines.length === 0) return fail('noLines');
      if (!data.supplierId) return fail('missingSupplier');
      if (data.expectedDate < data.orderDate) return fail('expectedDateBeforeOrder');

      const now = new Date().toISOString();
      const draft: PurchaseOrder = {
        id: existing?.id ?? newId(),
        number: null,
        status: 'draft',
        supplierId: data.supplierId,
        supplierSnapshot: null,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate,
        paymentTerms: data.paymentTerms,
        currency: data.currency,
        notes: data.notes,
        lines: data.lines.map((item) => ({ ...item, id: newId(), receivedQty: 0 })),
        receptions: [],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        confirmedAt: null,
        cancelledAt: null,
      };
      replace(draft);
      return of(draft);
    },

    confirmOrder: (id: string): Observable<PurchaseOrder> => {
      const order = items.find((item) => item.id === id);
      if (!order) return fail('notFound');
      if (order.status !== 'draft') return fail('notDraft');
      if (order.lines.length === 0) return fail('noLines');

      const now = new Date().toISOString();
      const confirmed: PurchaseOrder = {
        ...order,
        number: `BC-${order.orderDate.slice(0, 4)}-0001`,
        status: 'confirmed',
        supplierSnapshot: { name: 'Test supplier', taxId: '', address: '' },
        confirmedAt: now,
        updatedAt: now,
      };
      replace(confirmed);
      return of(confirmed);
    },

    cancelOrder: (id: string): Observable<PurchaseOrder> => {
      const order = items.find((item) => item.id === id);
      if (!order) return fail('notFound');
      if (order.status !== 'confirmed') return fail('notConfirmed');
      if (order.receptions.length > 0) return fail('hasReceptions');

      const now = new Date().toISOString();
      const cancelled: PurchaseOrder = { ...order, status: 'cancelled', cancelledAt: now, updatedAt: now };
      replace(cancelled);
      return of(cancelled);
    },

    duplicateOrder: (id: string): Observable<PurchaseOrder> => {
      const order = items.find((item) => item.id === id);
      if (!order) return fail('notFound');
      if (order.status === 'cancelled') return fail('cancelledOrder');

      const now = new Date().toISOString();
      const copy: PurchaseOrder = {
        ...order,
        id: newId(),
        number: null,
        status: 'draft',
        supplierSnapshot: null,
        orderDate: now.slice(0, 10),
        expectedDate: now.slice(0, 10),
        lines: order.lines.map((item) => ({ ...item, id: newId(), receivedQty: 0 })),
        receptions: [],
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        cancelledAt: null,
      };
      replace(copy);
      return of(copy);
    },

    receiveOrder: (id: string, input: ReceiveInput): Observable<PurchaseOrder> => {
      const order = items.find((item) => item.id === id);
      if (!order) return fail('notFound');
      if (order.status !== 'confirmed') return fail('notConfirmed');
      if (receptionState(order.lines) === 'complete') return fail('alreadyComplete');

      const invalid = input.items.some((item) => {
        const orderLine = order.lines.find((candidate) => candidate.id === item.lineId);
        return !orderLine || !canReceive(orderLine, item.quantity);
      });
      if (invalid || input.items.length === 0) return fail('invalidReceiveQty');

      const now = new Date().toISOString();
      const updated: PurchaseOrder = {
        ...order,
        lines: order.lines.map((orderLine) => {
          const item = input.items.find((candidate) => candidate.lineId === orderLine.id);
          return item
            ? { ...orderLine, receivedQty: orderLine.receivedQty + item.quantity }
            : orderLine;
        }),
        receptions: [
          ...order.receptions,
          {
            id: newId(),
            date: input.date,
            blNumber: input.blNumber,
            lines: input.items.map((item) => ({ ...item })),
            createdAt: now,
          },
        ],
        updatedAt: now,
      };
      replace(updated);
      return of(updated);
    },

    deleteDraft: (id: string): Observable<void> => {
      const order = items.find((item) => item.id === id);
      if (!order) return fail('notFound');
      if (order.status !== 'draft') return fail('notDraft');

      const index = items.findIndex((item) => item.id === id);
      items.splice(index, 1);
      return of(undefined);
    },
  };
}

export function purchaseServiceStub(): Provider {
  return { provide: PurchaseService, useValue: createPurchaseStub() };
}

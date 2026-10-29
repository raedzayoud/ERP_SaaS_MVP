import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ReceiveInput } from '../models/purchase-order';
import { PurchaseService } from './purchase.service';
import { SupplierBillService } from './supplier-bill.service';

const ORDER_NO_RECEPTION = 'd4000000-0000-4000-8000-000000000002';
const ORDER_CANCELLED = 'd4000000-0000-4000-8000-000000000006';
const ORDER_ATLAS = 'd4000000-0000-4000-8000-000000000005';
const ORDER_BILLED = 'd4000000-0000-4000-8000-000000000004';
const ATLAS = 'f4a1c2e0-8a01-4a10-9d21-000000000004';
const VERDE = 'f4a1c2e0-8a01-4a10-9d21-000000000007';

const FA_ATLAS = 'f7000000-0000-4000-8000-000000000001';
const FA_NORD = 'f7000000-0000-4000-8000-000000000002';
const FA_FREIGHT = 'f7000000-0000-4000-8000-000000000003';
const FA_DELTA = 'f7000000-0000-4000-8000-000000000004';

describe('SupplierBillService', () => {
  let service: SupplierBillService;
  let orders: PurchaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SupplierBillService);
    orders = TestBed.inject(PurchaseService);
  });

  it('lists the seed bills', async () => {
    const page = await firstValueFrom(service.getBills({ page: 0, size: 10 }));
    expect(page.total).toBe(4);
  });

  it('restarts the FA sequence for a new billing year', async () => {
    const created = await firstValueFrom(
      service.saveDraft({
        id: null,
        supplierId: VERDE,
        billingDate: '2027-01-10',
        dueDate: '2027-02-10',
        notes: '',
        lines: [{ productId: null, reference: 'A', description: 'Test', unit: 'piece', quantity: 1, unitCost: 10, vatRate: 0 }],
      }),
    );

    expect(created.number).toBe('FA-2027-0001');
  });

  it('computes the seed states from the payment ledger', async () => {
    const atlas = await firstValueFrom(service.getBill(FA_ATLAS));
    const nord = await firstValueFrom(service.getBill(FA_NORD));
    const freight = await firstValueFrom(service.getBill(FA_FREIGHT));

    expect(service.stateOf(atlas!)).toBe('paid');
    expect(service.outstandingOf(atlas!)).toBeCloseTo(0, 2);
    expect(service.stateOf(nord!)).toBe('partial');
    expect(service.outstandingOf(nord!)).toBeCloseTo(295.95, 2);
    expect(service.stateOf(freight!)).toBe('unpaid');
    expect(service.overdue(freight!)).toBe(true);
  });

  it('bills an order from its receptions (happy path)', async () => {
    const draft = await firstValueFrom(
      orders.saveDraft({
        id: null,
        supplierId: VERDE,
        orderDate: '2026-10-26',
        expectedDate: '2026-11-05',
        paymentTerms: 'net30',
        currency: 'USD',
        notes: '',
        lines: [{ productId: 'a1000000-0000-4000-8000-000000000001', reference: 'SKU-1001', description: 'Laptop Pro 14', unit: 'piece', quantity: 2, unitCost: 900, discountPct: 0, vatRate: 19 }],
      }),
    );
    const confirmed = await firstValueFrom(orders.confirmOrder(draft.id));
    expect(confirmed.status).toBe('confirmed');

    const reception: ReceiveInput = {
      date: '2026-10-27',
      blNumber: 'BL-TEST-1',
      warehouseId: 'w1000000-0000-4000-8000-000000000001',
      items: [{ lineId: confirmed.lines[0].id, quantity: 2 }],
    };
    await firstValueFrom(orders.receiveOrder(confirmed.id, reception));

    const bill = await firstValueFrom(
      service.createFromOrder({
        orderId: confirmed.id,
        billingDate: '2026-10-27',
        dueDate: '2026-11-26',
        notes: '',
      }),
    );

    expect(bill.sourceType).toBe('order');
    expect(bill.orderId).toBe(confirmed.id);
    expect(bill.lines.length).toBe(1);
    expect(bill.lines[0].quantity).toBe(2);
    expect(service.totalOf(bill).totalTtc).toBeCloseTo(2142, 2);
    expect(service.stateOf(bill)).toBe('unpaid');
    expect(service.hasBillFor(confirmed.id)).toBe(true);
  });

  it('rejects a second bill on the same order', async () => {
    const promise = firstValueFrom(
      service.createFromOrder({
        orderId: ORDER_ATLAS,
        billingDate: '2026-10-27',
        dueDate: '2026-11-27',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'orderAlreadyBilled' });
  });

  it('rejects an order without any reception', async () => {
    const promise = firstValueFrom(
      service.createFromOrder({
        orderId: ORDER_NO_RECEPTION,
        billingDate: '2026-10-27',
        dueDate: '2026-11-27',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'nothingReceived' });
  });

  it('rejects a due date before the billing date', async () => {
    const standalone = firstValueFrom(
      service.saveDraft({
        id: null,
        supplierId: VERDE,
        billingDate: '2026-10-27',
        dueDate: '2026-10-20',
        notes: '',
        lines: [{ productId: null, reference: 'A', description: 'Test', unit: 'piece', quantity: 1, unitCost: 10, vatRate: 0 }],
      }),
    );

    await expect(standalone).rejects.toMatchObject({ code: 'dueDateBeforeBilling' });
  });

  it('rejects a standalone bill without lines or supplier', async () => {
    const noLines = firstValueFrom(
      service.saveDraft({
        id: null,
        supplierId: VERDE,
        billingDate: '2026-10-27',
        dueDate: '2026-11-27',
        notes: '',
        lines: [],
      }),
    );
    await expect(noLines).rejects.toMatchObject({ code: 'noLines' });

    const noSupplier = firstValueFrom(
      service.saveDraft({
        id: null,
        supplierId: '',
        billingDate: '2026-10-27',
        dueDate: '2026-11-27',
        notes: '',
        lines: [{ productId: null, reference: 'A', description: 'Test', unit: 'piece', quantity: 1, unitCost: 10, vatRate: 0 }],
      }),
    );
    await expect(noSupplier).rejects.toMatchObject({ code: 'missingSupplier' });
  });

  it('rejects an overpayment on a bill', async () => {
    const promise = firstValueFrom(
      service.addPayment(FA_DELTA, {
        invoiceId: FA_DELTA,
        date: '2026-10-27',
        amount: 999,
        mode: 'transfer',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'overpaid' });

    const paid = await firstValueFrom(
      service.addPayment(FA_DELTA, {
        invoiceId: FA_DELTA,
        date: '2026-10-27',
        amount: 285.6,
        mode: 'transfer',
        reference: 'VIR-TEST',
        notes: '',
      }),
    );

    expect(paid.direction).toBe('out');
    await expect(firstValueFrom(service.getBill(FA_DELTA))).resolves.toMatchObject({
      id: FA_DELTA,
    });
    const delta = await firstValueFrom(service.getBill(FA_DELTA));
    expect(service.stateOf(delta!)).toBe('paid');
  });

  it('refuses to delete a bill that has payments', async () => {
    const promise = firstValueFrom(service.deleteBill(FA_ATLAS));
    await expect(promise).rejects.toMatchObject({ code: 'hasPayments' });
  });

  it('lists billable orders only once', async () => {
    const billable = await firstValueFrom(service.billableOrders());

    const ids = billable.map((order) => order.id);
    expect(ids).not.toContain(ORDER_BILLED);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('duplicates a confirmed order into a new editable draft', async () => {
    const created = await firstValueFrom(orders.duplicateOrder(ORDER_ATLAS));

    expect(created.id).not.toBe(ORDER_ATLAS);
    expect(created.status).toBe('draft');
    expect(created.number).toBeNull();
    expect(created.supplierId).toBe(ATLAS);
    expect(created.lines[0].receivedQty).toBe(0);
    expect(created.receptions.length).toBe(0);
  });

  it('rejects duplicating a cancelled order', async () => {
    const promise = firstValueFrom(orders.duplicateOrder(ORDER_CANCELLED));
    await expect(promise).rejects.toMatchObject({ code: 'cancelledOrder' });
  });
});

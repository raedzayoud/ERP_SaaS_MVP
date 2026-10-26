import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MAIN_WAREHOUSE_ID } from '../../stock/models/warehouse';
import { StockService } from '../../stock/services/stock.service';
import { SalesOrderService } from './sales-order.service';
import { DeliveryNoteService } from './delivery-note.service';
import { InvoiceService } from '../../invoices/services/invoice.service';

const CONFIRMED_ORDER = 'e5000000-0000-4000-8000-000000000002';
const DRAFT_ORDER = 'e5000000-0000-4000-8000-000000000001';
const LAPTOP = 'a1000000-0000-4000-8000-000000000001';

describe('DeliveryNoteService', () => {
  let service: DeliveryNoteService;
  let stock: StockService;
  let sales: SalesOrderService;
  let invoices: InvoiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeliveryNoteService);
    stock = TestBed.inject(StockService);
    sales = TestBed.inject(SalesOrderService);
    invoices = TestBed.inject(InvoiceService);
  });

  /** Delivers the confirmed demo order and returns the created note. */
  const deliverOrder = async () =>
    firstValueFrom(
      service.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
      }),
    );

  const laptopLevel = async (): Promise<number> => {
    const rows = await firstValueFrom(stock.getLevels({ warehouseId: MAIN_WAREHOUSE_ID }));
    return rows.find((row) => row.productId === LAPTOP)?.quantity ?? 0;
  };

  it('creates a delivery for a confirmed order with a sequential number', async () => {
    const note = await firstValueFrom(
      service.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
        notes: '',
      }),
    );

    expect(note.deliveryNumber).toBe('BL-2026-0002');
    expect(note.salesOrderNumber).toBe('CMD-2026-0001');
    expect(note.lines.length).toBe(1);
    expect(note.lines[0].quantity).toBe(4);
    expect(note.status).toBe('issued');

    const byOrder = await firstValueFrom(service.getDeliveryByOrder(CONFIRMED_ORDER));
    expect(byOrder?.id).toBe(note.id);
  });

  it('decrements the stock when the delivery is created', async () => {
    const before = await laptopLevel();

    await firstValueFrom(
      service.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
      }),
    );

    const after = await laptopLevel();
    expect(after).toBe(before - 4);
  });

  it('rejects a second delivery for the same order', async () => {
    await firstValueFrom(
      service.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
      }),
    );

    await expect(
      firstValueFrom(
        service.create({
          salesOrderId: CONFIRMED_ORDER,
          warehouseId: MAIN_WAREHOUSE_ID,
          deliveryDate: '2026-10-26',
        }),
      ),
    ).rejects.toMatchObject({ code: 'alreadyDelivered' });
  });

  it('rejects the delivery of a draft order', async () => {
    await expect(
      firstValueFrom(
        service.create({
          salesOrderId: DRAFT_ORDER,
          warehouseId: MAIN_WAREHOUSE_ID,
          deliveryDate: '2026-10-25',
        }),
      ),
    ).rejects.toMatchObject({ code: 'orderNotConfirmed' });
  });

  it('rejects an unknown order', async () => {
    await expect(
      firstValueFrom(
        service.create({
          salesOrderId: 'does-not-exist',
          warehouseId: MAIN_WAREHOUSE_ID,
          deliveryDate: '2026-10-25',
        }),
      ),
    ).rejects.toMatchObject({ code: 'orderNotFound' });
  });

  it('builds a draft invoice that reuses the order prices', async () => {
    const order = await firstValueFrom(sales.getOrder(CONFIRMED_ORDER));
    const delivery = await deliverOrder();

    const invoice = await firstValueFrom(service.createInvoiceDraft(delivery.id));

    expect(invoice.status).toBe('draft');
    expect(invoice.number).toBeNull();
    expect(invoice.salesOrderId).toBe(CONFIRMED_ORDER);
    expect(invoice.deliveryNoteId).toBe(delivery.id);
    expect(invoice.customerId).toBe(order?.customerId);
    expect(invoice.currency).toBe(order?.currency);

    const deliveredLine = delivery.lines.find((line) => line.productId === LAPTOP);
    const invoiceLine = invoice.lines.find((line) => line.productId === LAPTOP);
    const orderLine = order?.lines.find((line) => line.productId === LAPTOP);

    expect(invoiceLine?.quantity).toBe(deliveredLine?.quantity);
    expect(invoiceLine?.unitPrice).toBe(orderLine?.unitPrice);
    expect(invoiceLine?.discountPct).toBe(orderLine?.discountPct);
    expect(invoiceLine?.vatRate).toBe(orderLine?.vatRate);
  }, 15000);

  it('decrements the stock exactly once across the delivery and its invoice', async () => {
    const before = await laptopLevel();
    const delivery = await deliverOrder();

    const afterDelivery = await laptopLevel();
    expect(afterDelivery).toBe(before - 4);

    const draft = await firstValueFrom(service.createInvoiceDraft(delivery.id));
    const posted = await firstValueFrom(invoices.postInvoice(draft.id));

    expect(posted.status).toBe('posted');

    const afterPost = await laptopLevel();
    expect(afterPost).toBe(afterDelivery);
  }, 15000);

  it('refuses a second invoice for the same delivery note', async () => {
    const delivery = await deliverOrder();

    await firstValueFrom(service.createInvoiceDraft(delivery.id));

    await expect(
      firstValueFrom(service.createInvoiceDraft(delivery.id)),
    ).rejects.toMatchObject({ code: 'alreadyInvoiced' });
  });

  it('allows a new draft invoice after the previous draft is deleted', async () => {
    const delivery = await deliverOrder();

    const first = await firstValueFrom(service.createInvoiceDraft(delivery.id));
    await firstValueFrom(invoices.deleteDraft(first.id));

    const second = await firstValueFrom(service.createInvoiceDraft(delivery.id));

    expect(second.id).not.toBe(first.id);
    expect(second.deliveryNoteId).toBe(delivery.id);

    const linked = await firstValueFrom(invoices.getInvoiceForDelivery(delivery.id));
    expect(linked?.id).toBe(second.id);
  }, 15000);
});

import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SalesError, SalesOrderService } from './sales-order.service';
import { StockService } from '../../stock/services/stock.service';
import { DeliveryNoteService } from './delivery-note.service';
import { MAIN_WAREHOUSE_ID } from '../../stock/models/warehouse';
import { InvoicingSettingsService } from '../../invoicing/services/invoicing-settings.service';

const QUOTE_POSTED = 'c3000000-0000-4000-8000-000000000008';
const QUOTE_DRAFT = 'c3000000-0000-4000-8000-000000000007';
const INVOICE_FAC_0001 = 'c3000000-0000-4000-8000-000000000002';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const CONFIRMED_ORDER = 'e5000000-0000-4000-8000-000000000002';

describe('SalesOrderService quote conversion', () => {
  let service: SalesOrderService;
  let stock: StockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesOrderService);
    stock = TestBed.inject(StockService);
  });

  it('creates a draft order from a posted quote without stock movement', async () => {
    const order = await firstValueFrom(service.convertQuoteToOrder(QUOTE_POSTED));

    expect(order.status).toBe('draft');
    expect(order.number).toBeNull();
    expect(order.originQuoteId).toBe(QUOTE_POSTED);
    expect(order.customerId).toBe(GLOBAL);
    expect(order.lines.length).toBe(2);
    expect(order.lines[0].reference).toBe('SKU-1001');
    expect(order.lines[0].unit).toBe('piece');
    expect(order.lines[1].reference).toBe('SKU-2001');
    expect(order.lines[1].unit).toBe('hour');

    const movements = await firstValueFrom(stock.getMovements({ page: 0, size: 500 }));
    expect(movements.items.some((movement) => movement.refId === order.id)).toBe(false);
  });

  it('assigns a CMD number when the draft created from a quote is confirmed', async () => {
    const draft = await firstValueFrom(service.convertQuoteToOrder(QUOTE_POSTED));
    const confirmed = await firstValueFrom(service.confirmOrder(draft.id));

    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.number).toMatch(/^CMD-\d{4}-\d{4}$/);
    expect(confirmed.originQuoteId).toBe(QUOTE_POSTED);
  });

  it('rejects a conversion when the id is not a quote', async () => {
    const promise = firstValueFrom(service.convertQuoteToOrder(INVOICE_FAC_0001));
    await expect(promise).rejects.toMatchObject({ code: 'notQuote' });
  });

  it('rejects the conversion of a draft quote', async () => {
    const promise = firstValueFrom(service.convertQuoteToOrder(QUOTE_DRAFT));
    await expect(promise).rejects.toMatchObject({ code: 'notDraft' });
  });

  it('rejects a second conversion of the same quote', async () => {
    await firstValueFrom(service.convertQuoteToOrder(QUOTE_POSTED));

    const promise = firstValueFrom(service.convertQuoteToOrder(QUOTE_POSTED));
    await expect(promise).rejects.toMatchObject({ code: 'quoteAlreadyConverted' });
  });

  it('finds the order linked to a quote', async () => {
    const created = await firstValueFrom(service.convertQuoteToOrder(QUOTE_POSTED));
    const found = await firstValueFrom(service.getOrderByQuote(QUOTE_POSTED));

    expect(found?.id).toBe(created.id);
  });

  it('returns no order for a quote that was never converted', async () => {
    const found = await firstValueFrom(service.getOrderByQuote(QUOTE_DRAFT));
    expect(found).toBeUndefined();
  });

  it('filters orders by customerId', async () => {
    const page = await firstValueFrom(
      service.getOrders({ page: 0, size: 500, customerId: GLOBAL }),
    );

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((order) => order.customerId === GLOBAL)).toBe(true);
  });

  it('raises SalesError instances for failed conversions', async () => {
    const promise = firstValueFrom(service.convertQuoteToOrder(QUOTE_DRAFT));

    await promise.catch((error: unknown) => {
      expect(error).toBeInstanceOf(SalesError);
    });
  });
});

describe('SalesOrderService delivery and invoice guards', () => {
  let service: SalesOrderService;
  let deliveries: DeliveryNoteService;
  let invoicingSettings: InvoicingSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SalesOrderService);
    deliveries = TestBed.inject(DeliveryNoteService);
    invoicingSettings = TestBed.inject(InvoicingSettingsService);
  });

  it('refuses direct invoice creation for a delivered order', async () => {
    await firstValueFrom(
      deliveries.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
      }),
    );

    await expect(firstValueFrom(service.createInvoice(CONFIRMED_ORDER))).rejects.toMatchObject({
      code: 'hasDelivery',
    });
  }, 15000);

  it('refuses cancelling an order that already has a delivery note', async () => {
    await firstValueFrom(
      deliveries.create({
        salesOrderId: CONFIRMED_ORDER,
        warehouseId: MAIN_WAREHOUSE_ID,
        deliveryDate: '2026-10-25',
      }),
    );

    await expect(firstValueFrom(service.cancelOrder(CONFIRMED_ORDER))).rejects.toMatchObject({
      code: 'hasDelivery',
    });
  }, 15000);

  it('keeps the direct invoice draft linked to the order', async () => {
    const invoice = await firstValueFrom(service.createInvoice(CONFIRMED_ORDER));

    expect(invoice.salesOrderId).toBe(CONFIRMED_ORDER);
    expect(invoice.deliveryNoteId).toBeNull();
    expect(invoice.stampDuty).toBe(invoicingSettings.settings().defaultStampDuty);

    const order = await firstValueFrom(service.getOrder(CONFIRMED_ORDER));
    expect(order?.invoiceId).toBe(invoice.id);

    const found = await firstValueFrom(service.getOrderByInvoice(invoice.id));
    expect(found?.id).toBe(CONFIRMED_ORDER);
  }, 15000);
});

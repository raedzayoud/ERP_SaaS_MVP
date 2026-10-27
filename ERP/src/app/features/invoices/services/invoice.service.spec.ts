import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { InvoiceService } from './invoice.service';
import { PaymentService } from '../../payments/services/payment.service';
import { StockService } from '../../stock/services/stock.service';
import { todayIso } from '../../../shared/utils/money';

const QUOTE_DRAFT = 'c3000000-0000-4000-8000-000000000007';
const QUOTE_POSTED = 'c3000000-0000-4000-8000-000000000008';
const GLOBAL = 'f4a1c2e0-8a01-4a10-9d21-000000000002';
const ACME = 'f4a1c2e0-8a01-4a10-9d21-000000000001';
const ORIGIN_INVOICE = 'c3000000-0000-4000-8000-000000000005';
const LAPTOP = 'a1000000-0000-4000-8000-000000000001';

describe('InvoiceService quotes', () => {
  let service: InvoiceService;
  let payments: PaymentService;
  let stock: StockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InvoiceService);
    payments = TestBed.inject(PaymentService);
    stock = TestBed.inject(StockService);
  });

  it('posts a draft quote with a DEV number and no stock movement', async () => {
    const posted = await firstValueFrom(service.postInvoice(QUOTE_DRAFT));

    expect(posted.kind).toBe('quote');
    expect(posted.status).toBe('posted');
    expect(posted.number).toMatch(/^DEV-2026-\d{4}$/);

    const movements = await firstValueFrom(stock.getMovements({ page: 0, size: 500 }));
    expect(movements.items.some((movement) => movement.refId === posted.id)).toBe(false);
  });

  it('excludes quotes from invoice and credit note queries', async () => {
    const page = await firstValueFrom(
      service.getInvoices({
        page: 0,
        size: 500,
        status: 'posted',
        kinds: ['invoice', 'credit_note'],
      }),
    );

    expect(page.items.every((invoice) => invoice.kind !== 'quote')).toBe(true);
    expect(page.total).toBe(5);
  });

  it('filters invoices by customerId', async () => {
    const page = await firstValueFrom(
      service.getInvoices({ page: 0, size: 500, customerId: GLOBAL }),
    );

    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((invoice) => invoice.customerId === GLOBAL)).toBe(true);
  });

  it('refuses a payment on a quote', async () => {
    const promise = firstValueFrom(
      payments.createPayment({
        invoiceId: QUOTE_POSTED,
        date: '2026-10-23',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invoiceNotPosted' });
  });
});

describe('InvoiceService credit note cap', () => {
  let service: InvoiceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InvoiceService);
  });

  const creditNoteDraft = (quantity: number) => ({
    id: null as string | null,
    kind: 'credit_note' as const,
    customerId: ACME,
    issueDate: todayIso(),
    dueDate: todayIso(),
    paymentTerms: 'immediate' as const,
    currency: 'USD',
    stampDuty: 0,
    notes: '',
    originInvoiceId: ORIGIN_INVOICE,
    salesOrderId: null as string | null,
    deliveryNoteId: null as string | null,
    lines: [
      {
        productId: LAPTOP,
        reference: 'SKU-1001',
        description: 'Laptop Pro 14',
        unit: 'piece',
        quantity,
        unitPrice: 1299,
        discountPct: 0,
        vatRate: 19,
      },
    ],
  });

  it('accepts a credit note that stays under the original total', async () => {
    await expect(firstValueFrom(service.saveDraft(creditNoteDraft(1)))).resolves.toMatchObject({
      kind: 'credit_note',
      status: 'draft',
    });
  });

  it('rejects a credit note that would go over the original total', async () => {
    const promise = firstValueFrom(service.saveDraft(creditNoteDraft(3)));

    await expect(promise).rejects.toMatchObject({ code: 'creditLimitExceeded' });
  });
});

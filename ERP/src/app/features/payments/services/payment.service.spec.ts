import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PaymentError, PaymentService } from './payment.service';

const FAC_DRAFT = 'c3000000-0000-4000-8000-000000000001';
const FAC_0001 = 'c3000000-0000-4000-8000-000000000002';
const FAC_0003 = 'c3000000-0000-4000-8000-000000000004';
const CREDIT_NOTE = 'c3000000-0000-4000-8000-000000000006';

describe('PaymentService', () => {
  let service: PaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PaymentService);
  });

  it('lists the seed payments', async () => {
    const page = await firstValueFrom(service.getPayments({ page: 0, size: 10 }));

    expect(page.total).toBe(5);
  });

  it('filters by direction (in vs out)', async () => {
    const ins = await firstValueFrom(service.getPayments({ page: 0, size: 10, direction: 'in' }));
    const outs = await firstValueFrom(service.getPayments({ page: 0, size: 10, direction: 'out' }));

    expect(ins.total).toBe(3);
    expect(outs.total).toBe(2);
    expect(outs.items.every((payment) => payment.direction === 'out')).toBe(true);
    expect(outs.items[0].invoiceNumber.startsWith('FA-')).toBe(true);
  });

  it('filters by mode check', async () => {
    const page = await firstValueFrom(service.getPayments({ page: 0, size: 10, mode: 'check' }));

    expect(page.total).toBe(2);
    expect(page.items.every((payment) => payment.mode === 'check')).toBe(true);
  });

  it('creates a payment and increases the invoice amountPaid', async () => {
    const created = await firstValueFrom(
      service.createPayment({
        invoiceId: FAC_0001,
        date: '2026-10-20',
        amount: 200,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    expect(created.invoiceNumber).toBe('FAC-2026-0001');
    expect(created.partnerName).toBe('Global Ltd');
    expect(created.amount).toBe(200);

    const { InvoiceService } = await import('../../invoices/services/invoice.service');
    const invoices = TestBed.inject(InvoiceService);
    const invoice = await firstValueFrom(invoices.getInvoice(FAC_0001));
    expect(invoice?.amountPaid).toBe(200);
  });

  it('rejects a non-positive amount', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: FAC_0001,
        date: '2026-10-20',
        amount: 0,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invalidAmount' });
  });

  it('rejects an overpayment', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: FAC_0003,
        date: '2026-10-20',
        amount: 2000,
        mode: 'transfer',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'overpaid' });
  });

  it('rejects a payment on a draft invoice', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: FAC_DRAFT,
        date: '2026-10-20',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invoiceNotPosted' });
  });

  it('rejects a payment on a credit note', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: CREDIT_NOTE,
        date: '2026-10-20',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invoiceNotPosted' });
  });

  it('rejects a payment on an unknown invoice', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: 'unknown-id',
        date: '2026-10-20',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'invoiceNotFound' });
  });

  it('filters payments by search', async () => {
    const page = await firstValueFrom(
      service.getPayments({ page: 0, size: 10, search: 'horizon' }),
    );

    expect(page.total).toBe(1);
    expect(page.items[0].partnerName).toBe('Horizon Media');
  });

  it('throws PaymentError on failures', async () => {
    const promise = firstValueFrom(
      service.createPayment({
        invoiceId: FAC_DRAFT,
        date: '2026-10-20',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    await expect(promise).rejects.toBeInstanceOf(PaymentError);
  });
});

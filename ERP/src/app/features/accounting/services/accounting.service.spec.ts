import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { AccountingService } from './accounting.service';
import { PaymentService } from '../../payments/services/payment.service';

const FAC_0004 = 'c3000000-0000-4000-8000-000000000005';
const CN_0001 = 'c3000000-0000-4000-8000-000000000006';
const FAC_0001 = 'c3000000-0000-4000-8000-000000000002';

function lineFor(
  entry: { lines: { accountCode: string; debit: number; credit: number }[] },
  code: string,
) {
  return entry.lines.find((line) => line.accountCode === code);
}

describe('AccountingService', () => {
  let service: AccountingService;
  let payments: PaymentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AccountingService);
    payments = TestBed.inject(PaymentService);
  });

  it('builds a balanced SALES entry for a posted invoice', async () => {
    const entry = await firstValueFrom(service.getJournalEntry(`inv:${FAC_0004}`));

    expect(entry).toBeDefined();
    expect(entry?.journal).toBe('SALES');
    expect(entry?.ref).toBe('FAC-2026-0004');
    expect(entry?.date).toBe('2026-09-10');

    const debit = entry!.lines.reduce((sum, line) => sum + line.debit, 0);
    const credit = entry!.lines.reduce((sum, line) => sum + line.credit, 0);
    expect(debit).toBeCloseTo(credit, 2);

    expect(lineFor(entry!, '411000')?.debit).toBeCloseTo(3552.86, 2);
    expect(lineFor(entry!, '701000')?.credit).toBeCloseTo(2338.2, 2);
    expect(lineFor(entry!, '706000')?.credit).toBeCloseTo(720, 2);
    expect(lineFor(entry!, '445710')?.credit).toBeCloseTo(494.66, 2);
  });

  it('reverses a credit note entry', async () => {
    const entry = await firstValueFrom(service.getJournalEntry(`inv:${CN_0001}`));

    expect(entry).toBeDefined();
    expect(entry?.journal).toBe('SALES');
    expect(entry?.ref).toBe('AV-2026-0001');

    expect(lineFor(entry!, '411000')?.credit).toBeCloseTo(770.4, 2);
    expect(lineFor(entry!, '411000')?.debit).toBe(0);
    expect(lineFor(entry!, '706000')?.debit).toBeCloseTo(720, 2);
    expect(lineFor(entry!, '445710')?.debit).toBeCloseTo(50.4, 2);
  });

  it('books a bank payment on account 512000', async () => {
    const entry = await firstValueFrom(
      service.getJournalEntry('pay:e5000000-0000-4000-8000-000000000001'),
    );

    expect(entry).toBeDefined();
    expect(entry?.journal).toBe('PAYMENTS');
    expect(lineFor(entry!, '512000')?.debit).toBeCloseTo(2000, 2);
    expect(lineFor(entry!, '411000')?.credit).toBeCloseTo(2000, 2);
    expect(lineFor(entry!, '530000')).toBeUndefined();
  });

  it('books a cash payment on account 530000', async () => {
    await firstValueFrom(
      payments.createPayment({
        invoiceId: FAC_0001,
        date: '2026-10-20',
        amount: 100,
        mode: 'cash',
        reference: '',
        notes: '',
      }),
    );

    const page = await firstValueFrom(
      service.getJournalEntries({ page: 0, size: 500, journal: 'PAYMENTS' }),
    );
    const cashEntry = page.items.find((entry) =>
      entry.lines.some((line) => line.accountCode === '530000'),
    );

    expect(cashEntry).toBeDefined();
    expect(lineFor(cashEntry!, '530000')?.debit).toBeCloseTo(100, 2);
    expect(lineFor(cashEntry!, '411000')?.credit).toBeCloseTo(100, 2);
  });

  it('books a confirmed purchase order and ignores cancelled ones', async () => {
    const page = await firstValueFrom(
      service.getJournalEntries({ page: 0, size: 500, journal: 'PURCHASES' }),
    );

    expect(page.total).toBe(4);

    const entry = await firstValueFrom(
      service.getJournalEntry('po:d4000000-0000-4000-8000-000000000002'),
    );
    expect(entry).toBeDefined();
    expect(entry?.ref).toBe('BC-2026-0001');
    expect(lineFor(entry!, '601000')?.debit).toBeCloseTo(3600, 2);
    expect(lineFor(entry!, '445660')?.debit).toBeCloseTo(684, 2);
    expect(lineFor(entry!, '401000')?.credit).toBeCloseTo(4284, 2);

    const cancelled = page.items.find(
      (item) => item.id === 'po:d4000000-0000-4000-8000-000000000006',
    );
    expect(cancelled).toBeUndefined();
  });

  it('values stock adjustments with the purchase price', async () => {
    const inEntry = await firstValueFrom(service.getJournalEntry('adj:sm-1001'));
    expect(inEntry).toBeDefined();
    expect(inEntry?.journal).toBe('STOCK');
    expect(lineFor(inEntry!, '310000')?.debit).toBeCloseTo(9000, 2);
    expect(lineFor(inEntry!, '793000')?.credit).toBeCloseTo(9000, 2);

    const outEntry = await firstValueFrom(service.getJournalEntry('adj:sm-1013'));
    expect(outEntry).toBeDefined();
    expect(lineFor(outEntry!, '693000')?.debit).toBeCloseTo(120, 2);
    expect(lineFor(outEntry!, '310000')?.credit).toBeCloseTo(120, 2);
  });

  it('aggregates a balanced trial balance', async () => {
    const rows = await firstValueFrom(service.getTrialBalance());

    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);

    const clients = rows.find((row) => row.code === '411000');
    expect(clients).toBeDefined();
    expect(clients!.debit).toBeGreaterThan(0);
    expect(clients!.credit).toBeGreaterThan(0);
    expect(clients!.balance).toBeCloseTo(clients!.debit - clients!.credit, 2);
  });

  it('filters journal entries by journal and date range', async () => {
    const sales = await firstValueFrom(
      service.getJournalEntries({ page: 0, size: 500, journal: 'SALES' }),
    );
    expect(sales.total).toBe(5);
    expect(sales.items.every((entry) => entry.journal === 'SALES')).toBe(true);

    const range = await firstValueFrom(
      service.getJournalEntries({ page: 0, size: 500, from: '2026-10-01', to: '2026-10-31' }),
    );
    expect(
      range.items.every((entry) => entry.date >= '2026-10-01' && entry.date <= '2026-10-31'),
    ).toBe(true);
    expect(range.total).toBeGreaterThan(0);
  });
});

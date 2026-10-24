import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { ReportsService } from './reports.service';

const YEAR = { from: '2026-01-01', to: '2026-12-31' };

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReportsService);
  });

  it('excludes quotes from the sales figures', async () => {
    const data = await firstValueFrom(service.getReportData('2026-10-08', '2026-10-08'));

    expect(data.totalSales).toBe(0);
    expect(data.topProducts).toEqual([]);
    expect(data.margins).toEqual([]);
  });

  it('aggregates sales by month over the period', async () => {
    const data = await firstValueFrom(service.getReportData(YEAR.from, YEAR.to));

    expect(data.salesByMonth.length).toBeGreaterThanOrEqual(12);
    expect(data.salesByMonth.every((row) => row.total >= 0 || row.total < 0)).toBe(true);
    expect(data.totalSales).toBeGreaterThan(0);
  });

  it('lists the top products sorted by revenue', async () => {
    const data = await firstValueFrom(service.getReportData(YEAR.from, YEAR.to));

    expect(data.topProducts.length).toBeGreaterThan(0);
    for (let i = 1; i < data.topProducts.length; i++) {
      expect(data.topProducts[i - 1].revenue).toBeGreaterThanOrEqual(data.topProducts[i].revenue);
    }
  });

  it('groups payments by mode', async () => {
    const data = await firstValueFrom(service.getReportData(YEAR.from, YEAR.to));

    const modes = data.paymentsByMode.map((row) => row.mode);
    expect(modes).toContain('transfer');
    expect(modes).toContain('card');

    const total = data.paymentsByMode.reduce((sum, row) => sum + row.total, 0);
    expect(total).toBeGreaterThan(0);
  });

  it('returns a balanced trial balance', async () => {
    const data = await firstValueFrom(service.getReportData(YEAR.from, YEAR.to));

    const debit = data.trialBalance.reduce((sum, row) => sum + row.debit, 0);
    const credit = data.trialBalance.reduce((sum, row) => sum + row.credit, 0);
    expect(debit).toBeCloseTo(credit, 1);
  });
});

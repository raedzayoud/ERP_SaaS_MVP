import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ReportData } from '../../../../reports/models/report';
import { ReportsService } from '../../../../reports/services/reports.service';
import { Payment } from '../../../../payments/models/payment';
import { PaymentService } from '../../../../payments/services/payment.service';
import { TenantService } from '../../../../../core/services/tenant.service';
import { Page } from '../../../../../shared/models/page';
import { Analytics } from './analytics';

// jsdom has no 2D canvas context: stub Chart.js so
// ChartCanvas can still be instantiated inside the page.
vi.mock('chart.js', () => {
  class ChartStub {
    constructor() {}
    destroy(): void {}
    static register(): void {}
  }
  return { Chart: ChartStub, registerables: [] };
});

const EN = {
  titles: { analytics: 'Analytics' },
  descriptions: { analytics: 'Business intelligence on real data.' },
  common: { loading: 'Loading…', retry: 'Retry' },
  analytics: {
    periods: { month: 'Month', quarter: 'Quarter', year: 'Year' },
    loadError: 'Failed.',
    loadErrorHint: 'Try again.',
    kpi: { sales: 'Sales', collected: 'Collected', outstanding: 'Outstanding', overdue: 'Overdue' },
    charts: {
      sales: 'Sales',
      salesTitle: 'Sales by month',
      customers: 'Revenue',
      customersTitle: 'Top customers',
      payments: 'Payments',
      paymentsTitle: 'Payments by mode',
      flowsTitle: 'Sales vs expenses',
      flows: { sales: 'Sales', expenses: 'Expenses' },
    },
  },
  payments: { modes: { cash: 'Cash', check: 'Check', transfer: 'Transfer', card: 'Card' } },
};

const REPORT: ReportData = {
  salesByMonth: [
    { month: '2026-09', label: 'Sep 26', total: 700 },
    { month: '2026-10', label: 'Oct 26', total: 500 },
  ],
  topProducts: [],
  paymentsByMode: [{ mode: 'cash', count: 1, total: 200 }],
  margins: [],
  trialBalance: [],
  aging: [],
  customers: [
    { partnerId: 'p1', name: 'Global Ltd', invoices: 2, revenue: 500 },
    { partnerId: 'p2', name: 'Atlas SARL', invoices: 3, revenue: 1200 },
  ],
  stockRows: [],
  totalSales: 1200,
  totalExpenses: 300,
  stockValue: 9000,
  outstanding: 300,
  overdue: 80,
};

const PAYMENT: Payment = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  invoiceNumber: 'FAC-2026-0001',
  partnerId: 'p1',
  partnerName: 'Global Ltd',
  date: '2026-10-12',
  amount: 200,
  mode: 'cash',
  reference: '',
  currency: 'USD',
  notes: '',
  direction: 'in',
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
};

function pageOf<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 0, size: Math.max(items.length, 1) };
}

describe('Analytics', () => {
  let calls: { from: string; to: string; direction?: string }[];

  async function setup(): Promise<ComponentFixture<Analytics>> {
    calls = [];

    TestBed.configureTestingModule({
      imports: [
        Analytics,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ReportsService,
          useValue: {
            getReportData: (from: string, to: string) => {
              calls.push({ from, to });
              return of(REPORT);
            },
          },
        },
        {
          provide: PaymentService,
          useValue: {
            getPayments: (query: { direction?: string; from?: string; to?: string }) => {
              calls.push({ ...query } as { from: string; to: string; direction?: string });
              return query.direction === 'in' ? of(pageOf([PAYMENT])) : of(pageOf([]));
            },
          },
        },
        {
          provide: TenantService,
          useValue: { currentTenant: () => ({ currency: 'USD' }) },
        },
      ],
    });

    // The real ChartCanvas renders a canvas element per chart.
    const fixture = TestBed.createComponent(Analytics);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the KPIs and the collected payments for the default year period', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;
    const digits = (element.textContent ?? '').replace(/[^0-9]/g, '');

    expect(digits).toContain('1200'); // sales
    expect(digits).toContain('200'); // collected
    expect(digits).toContain('300'); // outstanding
    expect(digits).toContain('80'); // overdue

    const active = element.querySelector('button.btn-primary');
    expect(active?.textContent).toContain('Year');
  });

  it('renders four charts with the top customers sorted by revenue', async () => {
    const fixture = await setup();
    const element = fixture.nativeElement as HTMLElement;

    const stubs = element.querySelectorAll('canvas');
    expect(stubs.length).toBe(4);

    const labels = fixture.componentInstance.topCustomersData().labels as string[];
    expect(labels.indexOf('Atlas SARL')).toBeLessThan(labels.indexOf('Global Ltd'));
  });

  it('reloads a narrower range when the period switches to the month', async () => {
    const fixture = await setup();

    const button = (
      fixture.nativeElement as HTMLElement
    ).querySelectorAll<HTMLButtonElement>('.period-actions button')[0];
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const range = calls[calls.length - 1];
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const wedge = (value: number, width: number) => String(value).padStart(width, '0');

    expect(fixture.componentInstance.isPeriod('month')).toBe(true);
    expect(range.from).toBe(
      `${from.getFullYear()}-${wedge(from.getMonth() + 1, 2)}-01`,
    );
    expect(range.to).toBe(
      `${to.getFullYear()}-${wedge(to.getMonth() + 1, 2)}-${wedge(to.getDate(), 2)}`,
    );
  });
});

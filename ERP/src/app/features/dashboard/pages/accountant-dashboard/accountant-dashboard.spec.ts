import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { AccountantDashboard } from './accountant-dashboard';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { Invoice } from '../../../invoices/models/invoice';
import { PaymentService } from '../../../payments/services/payment.service';
import { Payment } from '../../../payments/models/payment';
import { TenantService } from '../../../../core/services/tenant.service';
import { Page } from '../../../../shared/models/page';

const EN = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome back!',
    errorTitle: 'Something went wrong.',
    kpi: { outstanding: 'Outstanding invoices', overdue: 'Overdue', payments: 'Payments received', currentMonth: 'This month' },
    summary: { title: 'Summary' },
    recent: { title: 'Recent invoices' },
    quick: { title: 'Quick actions' },
    roles: {
      accountant: {
        subtitle: 'Keep receivables and invoices under control.',
        kpi: { toValidate: 'Invoices to validate' },
        quick: { payment: 'Register payment', payments: 'Payments', invoices: 'Invoices', accounting: 'Accounting' },
        recent: { title: 'Invoices to process', empty: 'No posted invoice yet.' },
      },
    },
  },
  invoices: { draftLabel: 'Draft' },
  common: { loading: 'Loading…', retry: 'Retry' },
};

const POSTED_INVOICE: Invoice = {
  id: 'inv-1',
  number: 'FAC-2026-0001',
  kind: 'invoice',
  status: 'posted',
  customerId: 'cust-1',
  customerSnapshot: { name: 'Global Ltd', taxId: '', address: '' },
  issueDate: '2026-10-10',
  dueDate: '2026-11-09',
  paymentTerms: 'net30',
  currency: 'USD',
  lines: [
    {
      id: 'l1',
      productId: null,
      description: 'Service',
      quantity: 1,
      unitPrice: 100,
      discountPct: 0,
      vatRate: 0,
    },
  ],
  stampDuty: 0,
  amountPaid: 0,
  notes: '',
  originInvoiceId: null,
  salesOrderId: null,
  deliveryNoteId: null,
  createdAt: '2026-10-10T10:00:00.000Z',
  updatedAt: '2026-10-10T10:00:00.000Z',
  postedAt: '2026-10-10T10:05:00.000Z',
};

const PAYMENT: Payment = {
  id: 'pay-1',
  invoiceId: 'inv-1',
  invoiceNumber: 'FAC-2026-0001',
  partnerId: 'cust-1',
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

describe('AccountantDashboard', () => {
  async function render(): Promise<ComponentFixture<AccountantDashboard>> {
    TestBed.configureTestingModule({
      imports: [
        AccountantDashboard,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: InvoiceService,
          useValue: {
            getSummary: () => of({ outstanding: 100, overdue: 50 }),
            getInvoices: (query: { status?: string; sort?: string }) =>
              query.status === 'draft'
                ? of(pageOf([], 4))
                : of(pageOf([POSTED_INVOICE])),
          },
        },
        {
          provide: PaymentService,
          useValue: { getPayments: () => of(pageOf([PAYMENT])) },
        },
        {
          provide: TenantService,
          useValue: { currentTenant: () => ({ currency: 'USD' }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(AccountantDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the receivables and payments KPIs', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('100');
    expect(text).toContain('50');
    expect(text).toContain('200');
  });

  it('counts the draft invoices to validate', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('4');
  });

  it('lists the posted invoices to process and the payment action', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('FAC-2026-0001');
    const hrefs = Array.from(element.querySelectorAll<HTMLAnchorElement>('a')).map(
      (link) => link.getAttribute('href'),
    );
    expect(hrefs).toContain('/payments/new');
    expect(hrefs).toContain('/accounting');
  });
});

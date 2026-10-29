import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { CommercialDashboard } from './commercial-dashboard';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { Invoice } from '../../../invoices/models/invoice';
import { PartnerService } from '../../../crm/services/partner.service';
import { Partner } from '../../../crm/models/partner';
import { TenantService } from '../../../../core/services/tenant.service';
import { Page } from '../../../../shared/models/page';

const EN = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome back!',
    errorTitle: 'Something went wrong.',
    kpi: { revenue: 'Revenue billed', outstanding: 'Outstanding invoices', overdue: 'Overdue', currentMonth: 'This month' },
    summary: { title: 'Summary', customers: 'Active customers' },
    recent: { title: 'Recent invoices', empty: 'No posted invoices yet.' },
    quick: { title: 'Quick actions', newInvoice: 'New invoice', newContact: 'New contact' },
    roles: {
      commercial: {
        subtitle: 'Follow your sales and receivables at a glance.',
        kpi: { monthCount: 'Invoices this month' },
        quick: { reminders: 'Reminders', invoices: 'Invoices' },
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

const CUSTOMER: Partner = {
  id: 'cust-1',
  kind: 'company',
  name: 'Global Ltd',
  parentId: null,
  isCustomer: true,
  isSupplier: false,
  taxId: '',
  email: '',
  phone: '',
  jobTitle: '',
  address: { street: '', city: '', country: 'US' },
  active: true,
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const SUPPLIER: Partner = {
  ...CUSTOMER,
  id: 'sup-1',
  name: 'Nord',
  isCustomer: false,
  isSupplier: true,
};

function pageOf<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 0, size: Math.max(items.length, 1) };
}

describe('CommercialDashboard', () => {
  async function render(): Promise<ComponentFixture<CommercialDashboard>> {
    TestBed.configureTestingModule({
      imports: [
        CommercialDashboard,
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
            getInvoices: () => of(pageOf([POSTED_INVOICE])),
            getSummary: () => of({ outstanding: 100, overdue: 50 }),
          },
        },
        {
          provide: PartnerService,
          useValue: { getPartners: () => of(pageOf([CUSTOMER, SUPPLIER])) },
        },
        {
          provide: TenantService,
          useValue: { currentTenant: () => ({ currency: 'USD' }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(CommercialDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the sales KPIs from the services', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('100');
    expect(text).toContain('50');
    expect(text).toContain('FAC-2026-0001');
  });

  it('lists the latest posted invoices', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Global Ltd');
    expect(text).toContain('Recent invoices');
  });

  it('keeps the reminders and invoices quick actions', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(element.querySelectorAll<HTMLAnchorElement>('a')).map(
      (link) => link.getAttribute('href'),
    );

    expect(hrefs).toContain('/reminders');
    expect(hrefs).toContain('/invoices');
  });
});

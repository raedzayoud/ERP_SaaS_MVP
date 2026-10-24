import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { DashboardHome } from './dashboard-home';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { Invoice } from '../../../invoices/models/invoice';
import { PartnerService } from '../../../crm/services/partner.service';
import { Partner } from '../../../crm/models/partner';
import { ProductService } from '../../../products/services/product.service';
import { Product } from '../../../products/models/product';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { PaymentService } from '../../../payments/services/payment.service';
import { Payment } from '../../../payments/models/payment';
import { StockService } from '../../../stock/services/stock.service';
import { StockLevelRow } from '../../../stock/models/stock-movement';
import { TenantService } from '../../../../core/services/tenant.service';
import { Page } from '../../../../shared/models/page';

const EN = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome back!',
    kpi: {
      revenue: 'Revenue billed',
      outstanding: 'Outstanding invoices',
      overdue: 'Overdue',
      payments: 'Payments received',
      currentMonth: 'This month',
      stockValue: 'Stock value',
      stockItems: 'references',
    },
    recent: { title: 'Recent invoices', empty: 'No posted invoices yet.' },
    quick: {
      title: 'Quick actions',
      newInvoice: 'New invoice',
      newContact: 'New contact',
      newProduct: 'New product',
      newOrder: 'New purchase order',
    },
    summary: {
      title: 'Summary',
      customers: 'Active customers',
      products: 'Active products',
      pendingOrders: 'Pending purchase orders',
      lateOrders: 'Late purchase orders',
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
  createdAt: '2026-10-12T10:00:00.000Z',
  updatedAt: '2026-10-12T10:00:00.000Z',
};

const LEVEL: StockLevelRow = {
  productId: 'prod-1',
  sku: 'SKU-1',
  name: 'Widget',
  unit: 'piece',
  purchasePrice: 50,
  quantity: 6,
  value: 300,
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

const PRODUCT: Product = {
  id: 'prod-1',
  sku: 'SKU-1',
  name: 'Widget',
  description: '',
  type: 'good',
  unit: 'piece',
  category: 'hardware',
  salePrice: 80,
  purchasePrice: 50,
  vatRate: 19,
  suppliers: [],
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function pageOf<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 0, size: Math.max(items.length, 1) };
}

describe('DashboardHome', () => {
  async function render(): Promise<ComponentFixture<DashboardHome>> {
    TestBed.configureTestingModule({
      imports: [
        DashboardHome,
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
          provide: PaymentService,
          useValue: { getPayments: () => of(pageOf([PAYMENT])) },
        },
        {
          provide: StockService,
          useValue: { getLevels: () => of([LEVEL]) },
        },
        {
          provide: PurchaseService,
          useValue: { getSummary: () => of({ awaiting: 2, late: 1 }) },
        },
        {
          provide: PartnerService,
          useValue: { getPartners: () => of(pageOf([CUSTOMER, SUPPLIER])) },
        },
        {
          provide: ProductService,
          useValue: { getProducts: () => of(pageOf([PRODUCT], 7)) },
        },
        {
          provide: TenantService,
          useValue: { currentTenant: () => ({ currency: 'USD' }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(DashboardHome);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows real KPI values from the services', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('100');
    expect(text).toContain('200');
    expect(text).toContain('300');
  });

  it('lists recent posted invoices', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('FAC-2026-0001');
    expect(text).toContain('Global Ltd');
  });

  it('shows summary counters from the services', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('7');
    expect(text).toContain('2');
    expect(text).toContain('1');
  });
});

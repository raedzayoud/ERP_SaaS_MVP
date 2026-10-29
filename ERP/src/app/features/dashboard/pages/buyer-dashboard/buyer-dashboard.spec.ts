import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { BuyerDashboard } from './buyer-dashboard';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { PurchaseOrder } from '../../../purchases/models/purchase-order';
import { PartnerService } from '../../../crm/services/partner.service';
import { Partner } from '../../../crm/models/partner';
import { ProductService } from '../../../products/services/product.service';
import { Product } from '../../../products/models/product';
import { TenantService } from '../../../../core/services/tenant.service';
import { Page } from '../../../../shared/models/page';

const EN = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome back!',
    errorTitle: 'Something went wrong.',
    kpi: { currentMonth: 'This month' },
    summary: { title: 'Summary', pendingOrders: 'Pending purchase orders', products: 'Active products' },
    recent: { title: 'Recent invoices', empty: 'No posted invoices yet.' },
    quick: { title: 'Quick actions', newOrder: 'New purchase order' },
    roles: {
      buyer: {
        subtitle: 'Track purchase orders, receptions and suppliers.',
        kpi: { pending: 'Awaiting reception', suppliers: 'Suppliers', products: 'Products' },
        quick: { orders: 'Purchase orders', suppliers: 'Suppliers', products: 'Products' },
        recent: { title: 'Recent purchase orders', empty: 'No purchase order yet.' },
      },
    },
  },
  purchases: {
    status: { draft: 'Draft', confirmed: 'Confirmed', cancelled: 'Cancelled' },
    tags: { late: 'Late' },
  },
  invoices: { draftLabel: 'Draft' },
  common: { loading: 'Loading…', retry: 'Retry' },
};

const ORDER: PurchaseOrder = {
  id: 'po-1',
  number: 'BC-2026-0007',
  status: 'confirmed',
  supplierId: 'sup-1',
  supplierSnapshot: { name: 'Nord Suppliers', taxId: '', address: '' },
  orderDate: '2026-10-05',
  expectedDate: '2026-10-20',
  paymentTerms: 'net30',
  currency: 'USD',
  notes: '',
  lines: [],
  receptions: [],
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
  confirmedAt: '2026-10-06T09:00:00.000Z',
  cancelledAt: null,
};

const DRAFT_ORDER: PurchaseOrder = {
  ...ORDER,
  id: 'po-2',
  number: null,
  status: 'draft',
  supplierSnapshot: { name: 'Nord Suppliers', taxId: '', address: '' },
  confirmedAt: null,
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

describe('BuyerDashboard', () => {
  async function render(): Promise<ComponentFixture<BuyerDashboard>> {
    TestBed.configureTestingModule({
      imports: [
        BuyerDashboard,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: PurchaseService,
          useValue: {
            getSummary: () => of({ awaiting: 2, late: 1 }),
            getOrders: () => of(pageOf([ORDER, DRAFT_ORDER])),
          },
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

    const fixture = TestBed.createComponent(BuyerDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the purchase KPIs from the services', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('2');
    expect(text).toContain('1');
    expect(text).toContain('7');
  });

  it('lists the recent purchase orders with their supplier and state', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('BC-2026-0007');
    expect(text).toContain('Nord Suppliers');
    expect(text).toContain('Confirmed');
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { ProductForm } from './product-form';
import { ProductService } from '../../services/product.service';
import { Product, ProductInput } from '../../models/product';
import { PartnerService } from '../../../crm/services/partner.service';
import { StockService } from '../../../stock/services/stock.service';
import { TenantService } from '../../../../core/services/tenant.service';

const EN = {
  products: {
    form: {
      newTitle: 'New product',
      editTitle: 'Edit product',
      openingStock: 'Opening stock',
      openingStockHint: 'Quantity available when the product is created.',
      openingWarehouse: 'Warehouse',
      openingWarehouseNone: 'No opening stock',
      openingQuantity: 'Quantity',
      noWarehouse: 'Create a warehouse before adding an opening stock.',
      name: 'Name',
      sku: 'SKU',
      save: 'Save',
    },
  },
  common: { loading: 'Loading…', back: 'Back' },
};

const WAREHOUSE = {
  id: 'w1',
  code: 'MAIN',
  name: 'Main Warehouse',
  active: true,
  createdAt: '',
  updatedAt: '',
};

const SAVED_PRODUCT: Product = {
  id: 'p1',
  sku: 'SKU-1001',
  name: 'Laptop Pro 14',
  description: '',
  type: 'good',
  unit: 'piece',
  category: 'hardware',
  salePrice: 1299,
  purchasePrice: 900,
  vatRate: 19,
  minStock: 6,
  suppliers: [],
  active: true,
  createdAt: '',
  updatedAt: '',
};

describe('ProductForm', () => {
  let created: ProductInput[];
  let updated: ProductInput[];

  function setup(
    options: {
      partnerId?: string;
      modules?: string[];
      product?: Product;
    } = {},
  ): ComponentFixture<ProductForm> {
    created = [];
    updated = [];

    TestBed.configureTestingModule({
      imports: [
        ProductForm,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(options.partnerId ? { id: options.partnerId } : {}),
            },
          },
        },
        {
          provide: ProductService,
          useValue: {
            getProducts: () => of({ items: [], total: 0, page: 0, size: 10 }),
            getProduct: () => of(options.product),
            createProduct: (input: ProductInput) => {
              created.push(input);
              return of({ ...SAVED_PRODUCT, ...input });
            },
            updateProduct: (id: string, input: ProductInput) => {
              updated.push(input);
              return of({ ...SAVED_PRODUCT, ...input, id });
            },
            archiveProduct: () => of(SAVED_PRODUCT),
            restoreProduct: () => of(SAVED_PRODUCT),
          },
        },
        {
          provide: PartnerService,
          useValue: { getPartners: () => of({ items: [], total: 0, page: 0, size: 10 }) },
        },
        {
          provide: StockService,
          useValue: { getWarehouses: () => of([WAREHOUSE]) },
        },
        {
          provide: TenantService,
          useValue: { isModuleEnabled: (moduleId: string) => (options.modules ?? []).includes(moduleId) },
        },
      ],
    });

    return TestBed.createComponent(ProductForm);
  }

  async function render(fixture: ComponentFixture<ProductForm>): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function setInput(el: HTMLElement, id: string, value: string): void {
    const input = el.querySelector<HTMLInputElement>(`#${id}`);
    if (!input) throw new Error(`Missing input #${id}`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function setSelect(el: HTMLElement, id: string, value: string): void {
    const select = el.querySelector<HTMLSelectElement>(`#${id}`);
    if (!select) throw new Error(`Missing select #${id}`);
    select.value = value;
    select.dispatchEvent(new Event('change'));
  }

  it('hides the opening stock when the workspace has no stock module', async () => {
    const fixture = setup({ modules: ['products'] });
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#openingQuantity')).toBeNull();
  });

  it('shows the opening stock when the workspace manages the stock', async () => {
    const fixture = setup({ modules: ['products', 'stock'] });
    await render(fixture);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#openingQuantity')).toBeTruthy();
    expect(el.querySelector('#openingWarehouseId')).toBeTruthy();
  });

  it('sends the opening stock when the product is created', async () => {
    const fixture = setup({ modules: ['products', 'stock'] });
    await render(fixture);

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const el = fixture.nativeElement as HTMLElement;
    setInput(el, 'sku', 'SKU-1001');
    setInput(el, 'name', 'Laptop Pro 14');
    setSelect(el, 'openingWarehouseId', 'w1');
    setInput(el, 'openingQuantity', '10');
    fixture.componentInstance.form.controls.suppliers.clear();
    fixture.componentInstance.submit();
    await fixture.whenStable();

    expect(created.length).toBe(1);
    expect(created[0].openingStock).toEqual({ warehouseId: 'w1', quantity: 10 });
  });

  it('does not send the opening stock when the product is edited', async () => {
    const fixture = setup({
      partnerId: 'p1',
      modules: ['products', 'stock'],
      product: SAVED_PRODUCT,
    });
    await render(fixture);

    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.form.controls.suppliers.clear();
    fixture.componentInstance.submit();
    await fixture.whenStable();

    expect(updated.length).toBe(1);
    expect(updated[0].openingStock).toBeUndefined();
  });
});

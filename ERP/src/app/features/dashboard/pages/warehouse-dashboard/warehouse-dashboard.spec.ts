import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { WarehouseDashboard } from './warehouse-dashboard';
import { StockService } from '../../../stock/services/stock.service';
import { StockLevelRow, StockMovementRow } from '../../../stock/models/stock-movement';
import { TenantService } from '../../../../core/services/tenant.service';
import { Page } from '../../../../shared/models/page';

const EN = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Welcome back!',
    errorTitle: 'Something went wrong.',
    kpi: { stockValue: 'Stock value', stockItems: 'references' },
    alerts: { lowStock: 'Low stock', viewStock: 'View stock' },
    summary: { title: 'Summary' },
    quick: { title: 'Quick actions' },
    roles: {
      warehouse: {
        subtitle: 'Watch stock levels, movements and warehouse alerts.',
        recent: { title: 'Latest stock movements', empty: 'No stock movement yet.' },
      },
    },
  },
  stock: {
    levels: {
      newAdjustment: 'New adjustment',
      newTransfer: 'New transfer',
      manageWarehouses: 'Manage warehouses',
      low: 'Low',
    },
    movements: {
      title: 'Stock movements',
      type: { purchase: 'Purchase', sale: 'Sale', adjustment: 'Adjustment', transfer: 'Transfer' },
    },
    warehouses: { title: 'Warehouses' },
  },
  common: { loading: 'Loading…', retry: 'Retry' },
};

const LEVEL: StockLevelRow = {
  productId: 'prod-1',
  sku: 'SKU-1',
  name: 'Widget',
  unit: 'piece',
  purchasePrice: 50,
  quantity: 6,
  value: 300,
  minStock: 10,
  low: true,
};

const MOVEMENT: StockMovementRow = {
  id: 'mov-1',
  type: 'sale',
  direction: 'out',
  productId: 'prod-1',
  warehouseId: 'w1',
  quantity: -2,
  date: '2026-10-12',
  reason: 'FAC-2026-0001',
  refId: 'inv-1',
  createdAt: '2026-10-12T10:00:00.000Z',
  productName: 'Widget',
  productSku: 'SKU-1',
  warehouseName: 'Main Warehouse',
};

function pageOf<T>(items: T[], total = items.length): Page<T> {
  return { items, total, page: 0, size: Math.max(items.length, 1) };
}

describe('WarehouseDashboard', () => {
  let levelsResponse: StockLevelRow[];

  async function render(): Promise<ComponentFixture<WarehouseDashboard>> {
    levelsResponse = [LEVEL];
    TestBed.configureTestingModule({
      imports: [
        WarehouseDashboard,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: { en: EN },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        {
          provide: StockService,
          useValue: {
            getLevels: () => of(levelsResponse),
            getMovements: () => of(pageOf([MOVEMENT])),
            getWarehouses: () => of([{ id: 'w1', code: 'MAIN', name: 'Main Warehouse', active: true, createdAt: '', updatedAt: '' }]),
          },
        },
        {
          provide: TenantService,
          useValue: { currentTenant: () => ({ currency: 'USD' }) },
        },
      ],
    });

    const fixture = TestBed.createComponent(WarehouseDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('shows the stock KPIs and the low-stock alert card', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';

    expect(text).toContain('$300.00');
    expect(text).toContain('6 / 10');
    expect(element.querySelector('.low-stock-card')).toBeTruthy();
  });

  it('lists the latest stock movements with product and warehouse', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Widget');
    expect(text).toContain('Main Warehouse');
    expect(text).toContain('Sale');
  });

  it('links the quick actions to the stock tools', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;
    const hrefs = Array.from(element.querySelectorAll<HTMLAnchorElement>('a')).map(
      (link) => link.getAttribute('href'),
    );

    expect(hrefs).toContain('/stock/adjustment');
    expect(hrefs).toContain('/stock/transfer');
  });
});

import { Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Page } from '../../../shared/models/page';
import {
  AdjustmentInput,
  AvailabilityIssue,
  ReceptionPostingInput,
  SalePostingInput,
  StockLevelRow,
  StockMovement,
  StockMovementQuery,
  StockMovementRow,
  TransferInput,
} from '../models/stock-movement';
import {
  Warehouse,
  WarehouseInput,
  WarehouseNameInput,
  WarehouseSummary,
} from '../models/warehouse';
import { MAIN_WAREHOUSE_ID } from '../models/warehouse';
import { TEST_PRODUCTS } from '../../products/services/product-test-stub';
import { StockService } from './stock.service';

/** Quantities of the demo catalog in the main warehouse. */
const INITIAL_LEVELS: Record<string, number> = {
  'a1000000-0000-4000-8000-000000000001': 8,
  'a1000000-0000-4000-8000-000000000002': 50,
  'a1000000-0000-4000-8000-000000000003': 8,
  'a1000000-0000-4000-8000-000000000008': 50,
  'a1000000-0000-4000-8000-000000000009': 10,
};

const LAPTOP = 'a1000000-0000-4000-8000-000000000001';
const MOUSE = 'a1000000-0000-4000-8000-000000000002';
const DOCK = 'a1000000-0000-4000-8000-000000000003';
const PAPER = 'a1000000-0000-4000-8000-000000000008';
const TONER = 'a1000000-0000-4000-8000-000000000009';
const SFX = 'w1000000-0000-4000-8000-000000000002';

/** The demo journal the mock accounting module still reads. */
const TEST_MOVEMENTS: StockMovementRow[] = [
  ['sm-1001', 'adjustment', 'in', LAPTOP, 10, '2026-08-01', 'Opening inventory', null],
  ['sm-1002', 'adjustment', 'in', DOCK, 8, '2026-08-01', 'Opening inventory', null],
  ['sm-1003', 'adjustment', 'in', MOUSE, 40, '2026-08-01', 'Opening inventory', null],
  ['sm-1004', 'adjustment', 'in', PAPER, 30, '2026-08-01', 'Opening inventory', null],
  ['sm-1005', 'adjustment', 'in', TONER, 12, '2026-08-01', 'Opening inventory', null],
  ['sm-1006', 'sale', 'out', LAPTOP, 2, '2026-09-10', 'FAC-2026-0004', 'c3000000-0000-4000-8000-000000000005'],
  ['sm-1007', 'purchase', 'in', MOUSE, 30, '2026-10-05', 'BL-7781', 'd4000000-0000-4000-8000-000000000004'],
  ['sm-1008', 'sale', 'out', MOUSE, 10, '2026-10-10', 'FAC-2026-0001', 'c3000000-0000-4000-8000-000000000002'],
  ['sm-1009', 'purchase', 'in', MOUSE, 5, '2026-10-18', 'BL-7802', 'd4000000-0000-4000-8000-000000000004'],
  ['sm-1010', 'purchase', 'in', PAPER, 20, '2026-10-18', 'BL-7802', 'd4000000-0000-4000-8000-000000000004'],
  ['sm-1011', 'transfer', 'out', MOUSE, 15, '2026-10-20', 'Transfer to Sfax', null],
  ['sm-1012', 'transfer', 'in', MOUSE, 15, '2026-10-20', 'Transfer from Tunis', null],
  ['sm-1013', 'adjustment', 'out', TONER, 2, '2026-10-21', 'Damaged cartridges', null],
].map(([id, type, direction, productId, quantity, date, reason, refId]) => {
  const product = TEST_PRODUCTS.find((item) => item.id === productId);
  return {
    id: id as string,
    type: type as StockMovementRow['type'],
    direction: direction as StockMovementRow['direction'],
    productId: productId as string,
    productName: product?.name ?? '',
    productSku: product?.sku ?? '',
    warehouseId: direction === 'in' && id === 'sm-1012' ? SFX : MAIN_WAREHOUSE_ID,
    warehouseName: direction === 'in' && id === 'sm-1012' ? 'Secondary Warehouse (Sfax)' : 'Main Warehouse (Tunis)',
    quantity: quantity as number,
    date: date as string,
    reason: reason as string,
    refId: (refId as string | null) ?? null,
    createdAt: `${date as string}T12:00:00.000Z`,
  };
});

/**
 * Keeps the mock features (invoices, sales, purchases, reports) working while
 * the stock is served by the API. The recorded postings let a spec check that
 * the stock was asked to move the goods.
 */
export function createStockStub() {
  const salePostings: SalePostingInput[] = [];
  const receptions: ReceptionPostingInput[] = [];
  const levels = { ...INITIAL_LEVELS };

  const levelRows = (warehouseId?: string): StockLevelRow[] =>
    TEST_PRODUCTS.filter((product) => product.type === 'good' && product.active).map(
      (product) => {
        const quantity = warehouseId && warehouseId !== MAIN_WAREHOUSE_ID ? 0 : levels[product.id] ?? 0;
        return {
          productId: product.id,
          sku: product.sku,
          name: product.name,
          unit: product.unit,
          purchasePrice: product.purchasePrice,
          quantity,
          value: quantity * product.purchasePrice,
          minStock: product.minStock ?? 0,
          low: (product.minStock ?? 0) > 0 && quantity <= (product.minStock ?? 0),
        };
      },
    );

  return {
    getWarehouses: (): Observable<Warehouse[]> => of([]),
    createWarehouse: (data: WarehouseInput): Observable<Warehouse> =>
      of({
        id: 'w1',
        code: data.code,
        name: data.name,
        active: true,
        createdAt: '',
        updatedAt: '',
      }),
    updateWarehouse: (id: string, data: WarehouseNameInput): Observable<Warehouse> =>
      of({ id, code: '', name: data.name, active: true, createdAt: '', updatedAt: '' }),
    archiveWarehouse: (id: string): Observable<Warehouse> =>
      of({ id, code: '', name: '', active: false, createdAt: '', updatedAt: '' }),
    restoreWarehouse: (id: string): Observable<Warehouse> =>
      of({ id, code: '', name: '', active: true, createdAt: '', updatedAt: '' }),
    getLevels: (query: { warehouseId?: string }): Observable<StockLevelRow[]> =>
      of(levelRows(query.warehouseId)),
    getLowStockLevels: (): Observable<StockLevelRow[]> =>
      of(levelRows().filter((row) => row.low)),
    getWarehouseSummaries: (): Observable<WarehouseSummary[]> => of([]),
    getMovements: (query: StockMovementQuery): Observable<Page<StockMovementRow>> => {
      const items = TEST_MOVEMENTS.filter(
        (movement) =>
          (query.type === undefined || movement.type === query.type) &&
          (query.warehouseId === undefined || movement.warehouseId === query.warehouseId),
      );
      return of({ items, total: items.length, page: query.page, size: query.size });
    },
    createAdjustment: (data: AdjustmentInput): Observable<StockMovement> =>
      of({
        id: 'sm1',
        type: 'adjustment',
        direction: data.direction,
        productId: data.productId,
        warehouseId: data.warehouseId,
        quantity: data.quantity,
        date: data.date,
        reason: data.reason,
        refId: null,
        createdAt: '',
      }),
    createTransfer: (): Observable<StockMovement[]> => of([]),
    checkAvailability: (): Observable<AvailabilityIssue[]> => of([]),
    recordPurchaseReception: (data: ReceptionPostingInput): Observable<StockMovement[]> => {
      receptions.push(data);
      for (const item of data.items) {
        levels[item.productId] = (levels[item.productId] ?? 0) + item.quantity;
      }
      return of([]);
    },
    recordSalePosting: (data: SalePostingInput): Observable<StockMovement[]> => {
      salePostings.push(data);
      for (const item of data.items) {
        levels[item.productId] = (levels[item.productId] ?? 0) - item.quantity;
      }
      return of([]);
    },
    salePostings,
    receptions,
  };
}

export function stockServiceStub(): Provider {
  return { provide: StockService, useValue: createStockStub() };
}

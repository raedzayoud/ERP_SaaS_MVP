import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, switchMap, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { ProductService } from '../../products/services/product.service';
import {
  AdjustmentInput,
  ReceptionPostingInput,
  SalePostingInput,
  StockLevelQuery,
  StockLevelRow,
  StockMovement,
  StockMovementQuery,
  StockMovementRow,
  TransferInput,
} from '../models/stock-movement';
import { MAIN_WAREHOUSE_ID, Warehouse, WarehouseInput } from '../models/warehouse';
import { AvailabilityIssue, findAvailabilityIssues, levelFor } from '../utils/stock-calc';

const LATENCY_MS = 300;

export type StockErrorCode =
  | 'notFound'
  | 'missingCode'
  | 'missingName'
  | 'warehouseExists'
  | 'lastActiveWarehouse'
  | 'invalidQuantity'
  | 'missingProduct'
  | 'notStockedProduct'
  | 'missingWarehouse'
  | 'inactiveWarehouse'
  | 'sameWarehouse'
  | 'missingReason'
  | 'insufficientStock';

export class StockError extends Error {
  constructor(readonly code: StockErrorCode) {
    super(code);
  }
}

const LAPTOP = 'a1000000-0000-4000-8000-000000000001';
const MOUSE = 'a1000000-0000-4000-8000-000000000002';
const DOCK = 'a1000000-0000-4000-8000-000000000003';
const PAPER = 'a1000000-0000-4000-8000-000000000008';
const TONER = 'a1000000-0000-4000-8000-000000000009';

const BC_0003 = 'd4000000-0000-4000-8000-000000000004';
const FAC_0001 = 'c3000000-0000-4000-8000-000000000002';
const FAC_0004 = 'c3000000-0000-4000-8000-000000000005';

const SEED_WAREHOUSES: Warehouse[] = [
  {
    id: MAIN_WAREHOUSE_ID,
    code: 'MAIN',
    name: 'Main Warehouse (Tunis)',
    active: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
  {
    id: 'w1000000-0000-4000-8000-000000000002',
    code: 'SFX',
    name: 'Secondary Warehouse (Sfax)',
    active: true,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-01T08:00:00.000Z',
  },
];

function movement(
  id: string,
  type: StockMovement['type'],
  direction: StockMovement['direction'],
  productId: string,
  warehouseId: string,
  quantity: number,
  date: string,
  reason: string,
  refId: string | null,
): StockMovement {
  return {
    id,
    type,
    direction,
    productId,
    warehouseId,
    quantity,
    date,
    reason,
    refId,
    createdAt: `${date}T12:00:00.000Z`,
  };
}

const SEED_MOVEMENTS: StockMovement[] = [
  movement(
    'sm-1001',
    'adjustment',
    'in',
    LAPTOP,
    MAIN_WAREHOUSE_ID,
    10,
    '2026-08-01',
    'Opening inventory',
    null,
  ),
  movement(
    'sm-1002',
    'adjustment',
    'in',
    DOCK,
    MAIN_WAREHOUSE_ID,
    8,
    '2026-08-01',
    'Opening inventory',
    null,
  ),
  movement(
    'sm-1003',
    'adjustment',
    'in',
    MOUSE,
    MAIN_WAREHOUSE_ID,
    40,
    '2026-08-01',
    'Opening inventory',
    null,
  ),
  movement(
    'sm-1004',
    'adjustment',
    'in',
    PAPER,
    MAIN_WAREHOUSE_ID,
    30,
    '2026-08-01',
    'Opening inventory',
    null,
  ),
  movement(
    'sm-1005',
    'adjustment',
    'in',
    TONER,
    MAIN_WAREHOUSE_ID,
    12,
    '2026-08-01',
    'Opening inventory',
    null,
  ),
  movement(
    'sm-1006',
    'sale',
    'out',
    LAPTOP,
    MAIN_WAREHOUSE_ID,
    2,
    '2026-09-10',
    'FAC-2026-0004',
    FAC_0004,
  ),
  movement(
    'sm-1007',
    'purchase',
    'in',
    MOUSE,
    MAIN_WAREHOUSE_ID,
    30,
    '2026-10-05',
    'BL-7781',
    BC_0003,
  ),
  movement(
    'sm-1008',
    'sale',
    'out',
    MOUSE,
    MAIN_WAREHOUSE_ID,
    10,
    '2026-10-10',
    'FAC-2026-0001',
    FAC_0001,
  ),
  movement(
    'sm-1009',
    'purchase',
    'in',
    MOUSE,
    MAIN_WAREHOUSE_ID,
    5,
    '2026-10-18',
    'BL-7802',
    BC_0003,
  ),
  movement(
    'sm-1010',
    'purchase',
    'in',
    PAPER,
    MAIN_WAREHOUSE_ID,
    20,
    '2026-10-18',
    'BL-7802',
    BC_0003,
  ),
  movement(
    'sm-1011',
    'transfer',
    'out',
    MOUSE,
    MAIN_WAREHOUSE_ID,
    15,
    '2026-10-20',
    'Transfer to Sfax',
    null,
  ),
  movement(
    'sm-1012',
    'transfer',
    'in',
    MOUSE,
    'w1000000-0000-4000-8000-000000000002',
    15,
    '2026-10-20',
    'Transfer from Tunis',
    null,
  ),
  movement(
    'sm-1013',
    'adjustment',
    'out',
    TONER,
    MAIN_WAREHOUSE_ID,
    2,
    '2026-10-21',
    'Damaged cartridges',
    null,
  ),
];

interface ProductLite {
  id: string;
  name: string;
  sku: string;
}

@Injectable({ providedIn: 'root' })
export class StockService {
  private readonly warehousesState = signal<Warehouse[]>(SEED_WAREHOUSES);
  private readonly movements = signal<StockMovement[]>(SEED_MOVEMENTS);
  private readonly products = inject(ProductService);

  getWarehouses(): Observable<Warehouse[]> {
    return timer(LATENCY_MS).pipe(map(() => this.warehousesState()));
  }

  createWarehouse(data: WarehouseInput): Observable<Warehouse> {
    const code = data.code.trim().toUpperCase();
    const name = data.name.trim();
    if (!code) return this.fail('missingCode');
    if (!name) return this.fail('missingName');
    if (this.warehousesState().some((w) => w.code.toUpperCase() === code)) {
      return this.fail('warehouseExists');
    }

    return timer(LATENCY_MS).pipe(
      map(() => {
        const now = new Date().toISOString();
        const created: Warehouse = {
          id: this.newId(),
          code,
          name,
          active: true,
          createdAt: now,
          updatedAt: now,
        };
        this.warehousesState.update((list) => [...list, created]);
        return created;
      }),
    );
  }

  archiveWarehouse(id: string): Observable<Warehouse> {
    const existing = this.warehousesState().find((w) => w.id === id);
    if (!existing) return this.fail('notFound');
    const activeCount = this.warehousesState().filter((w) => w.active).length;
    if (existing.active && activeCount <= 1) return this.fail('lastActiveWarehouse');

    return timer(LATENCY_MS).pipe(map(() => this.applyWarehouse(id, { active: false })));
  }

  restoreWarehouse(id: string): Observable<Warehouse> {
    const existing = this.warehousesState().find((w) => w.id === id);
    if (!existing) return this.fail('notFound');

    return timer(LATENCY_MS).pipe(map(() => this.applyWarehouse(id, { active: true })));
  }

  getLevels(query: StockLevelQuery): Observable<StockLevelRow[]> {
    return this.products.getProducts({ page: 0, size: 500, type: 'good', active: true }).pipe(
      switchMap((page) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            const movements = this.movements();
            const search = query.search?.trim().toLowerCase();

            const rows = page.items.map((product) => {
              const quantity = levelFor(movements, query.warehouseId, product.id);
              return {
                productId: product.id,
                sku: product.sku,
                name: product.name,
                unit: product.unit,
                purchasePrice: product.purchasePrice,
                quantity,
                value: quantity * product.purchasePrice,
              };
            });

            const filtered = search
              ? rows.filter(
                  (row) =>
                    row.name.toLowerCase().includes(search) ||
                    row.sku.toLowerCase().includes(search),
                )
              : rows;

            return filtered.sort((a, b) => a.name.localeCompare(b.name));
          }),
        ),
      ),
    );
  }

  getMovements(query: StockMovementQuery): Observable<Page<StockMovementRow>> {
    return this.products
      .getProducts({ page: 0, size: 500 })
      .pipe(
        switchMap((page) => timer(LATENCY_MS).pipe(map(() => this.buildPage(query, page.items)))),
      );
  }

  createAdjustment(data: AdjustmentInput): Observable<StockMovement> {
    if (!(data.quantity > 0)) return this.fail('invalidQuantity');
    if (!data.reason.trim()) return this.fail('missingReason');
    if (!this.isWarehouseUsable(data.warehouseId))
      return this.fail(this.warehouseIssue(data.warehouseId));

    return this.products.getProduct(data.productId).pipe(
      switchMap((product) => {
        if (!product) return this.fail('missingProduct');
        if (product.type !== 'good') return this.fail('notStockedProduct');

        return timer(LATENCY_MS).pipe(
          map(() => {
            const created = movement(
              this.newId(),
              'adjustment',
              data.direction,
              data.productId,
              data.warehouseId,
              data.quantity,
              data.date,
              data.reason.trim(),
              null,
            );
            this.movements.update((list) => [...list, created]);
            return created;
          }),
        );
      }),
    );
  }

  createTransfer(data: TransferInput): Observable<StockMovement[]> {
    if (!(data.quantity > 0)) return this.fail('invalidQuantity');
    if (!data.reason.trim()) return this.fail('missingReason');
    if (data.fromWarehouseId === data.toWarehouseId) return this.fail('sameWarehouse');
    if (!this.isWarehouseUsable(data.fromWarehouseId))
      return this.fail(this.warehouseIssue(data.fromWarehouseId));
    if (!this.isWarehouseUsable(data.toWarehouseId))
      return this.fail(this.warehouseIssue(data.toWarehouseId));

    const toWarehouse = this.warehousesState().find((w) => w.id === data.toWarehouseId);

    return this.products.getProduct(data.productId).pipe(
      switchMap((product) => {
        if (!product) return this.fail('missingProduct');
        if (product.type !== 'good') return this.fail('notStockedProduct');

        const available = levelFor(this.movements(), data.fromWarehouseId, product.id);
        if (available < data.quantity) return this.fail('insufficientStock');

        return timer(LATENCY_MS).pipe(
          map(() => {
            const out = movement(
              this.newId(),
              'transfer',
              'out',
              data.productId,
              data.fromWarehouseId,
              data.quantity,
              data.date,
              `Transfer to ${toWarehouse?.name ?? ''}`,
              null,
            );
            const inMovement = movement(
              this.newId(),
              'transfer',
              'in',
              data.productId,
              data.toWarehouseId,
              data.quantity,
              data.date,
              'Transfer received',
              null,
            );
            this.movements.update((list) => [...list, out, inMovement]);
            return [out, inMovement];
          }),
        );
      }),
    );
  }

  checkAvailability(
    warehouseId: string,
    items: { productId: string | null; quantity: number }[],
  ): Observable<AvailabilityIssue[]> {
    return this.products.getProducts({ page: 0, size: 500, type: 'good', active: true }).pipe(
      switchMap((page) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            const goodIds = new Set(page.items.map((product) => product.id));
            const requests = items
              .filter((item): item is { productId: string; quantity: number } => {
                return item.productId !== null && goodIds.has(item.productId);
              })
              .map((item) => ({ productId: item.productId, quantity: item.quantity }));

            return findAvailabilityIssues(this.movements(), warehouseId, requests);
          }),
        ),
      ),
    );
  }

  recordPurchaseReception(data: ReceptionPostingInput): Observable<StockMovement[]> {
    return this.products.getProducts({ page: 0, size: 500, type: 'good', active: true }).pipe(
      switchMap((page) =>
        timer(LATENCY_MS).pipe(
          map(() => {
            const goodIds = new Set(page.items.map((product) => product.id));
            const created = data.items
              .filter((item) => item.quantity > 0 && goodIds.has(item.productId))
              .map((item) =>
                movement(
                  this.newId(),
                  'purchase',
                  'in',
                  item.productId,
                  data.warehouseId,
                  item.quantity,
                  data.date,
                  data.blNumber || 'Supplier reception',
                  data.refId,
                ),
              );

            this.movements.update((list) => [...list, ...created]);
            return created;
          }),
        ),
      ),
    );
  }

  recordSalePosting(data: SalePostingInput): Observable<StockMovement[]> {
    return this.checkAvailability(data.warehouseId, data.items).pipe(
      switchMap((issues) => {
        if (issues.length > 0) return this.fail('insufficientStock');

        return this.products.getProducts({ page: 0, size: 500, type: 'good', active: true }).pipe(
          switchMap((page) =>
            timer(LATENCY_MS).pipe(
              map(() => {
                const goodIds = new Set(page.items.map((product) => product.id));
                const created = data.items
                  .filter((item) => item.quantity > 0 && goodIds.has(item.productId))
                  .map((item) =>
                    movement(
                      this.newId(),
                      'sale',
                      'out',
                      item.productId,
                      data.warehouseId,
                      item.quantity,
                      data.date,
                      'Sales invoice',
                      data.refId,
                    ),
                  );

                this.movements.update((list) => [...list, ...created]);
                return created;
              }),
            ),
          ),
        );
      }),
    );
  }

  private isWarehouseUsable(warehouseId: string): boolean {
    const warehouse = this.warehousesState().find((w) => w.id === warehouseId);
    return !!warehouse && warehouse.active;
  }

  private warehouseIssue(warehouseId: string): StockErrorCode {
    const warehouse = this.warehousesState().find((w) => w.id === warehouseId);
    if (!warehouse) return 'missingWarehouse';
    return 'inactiveWarehouse';
  }

  private applyWarehouse(id: string, patch: Partial<Warehouse>): Warehouse {
    let updated!: Warehouse;
    this.warehousesState.update((list) =>
      list.map((warehouse) => {
        if (warehouse.id !== id) return warehouse;
        updated = { ...warehouse, ...patch, updatedAt: new Date().toISOString() };
        return updated;
      }),
    );
    return updated;
  }

  private buildPage(query: StockMovementQuery, products: ProductLite[]): Page<StockMovementRow> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.movements().filter((item) => {
      if (query.type && item.type !== query.type) return false;
      if (query.warehouseId && item.warehouseId !== query.warehouseId) return false;
      if (search && !this.matchesSearch(item, search, products)) return false;
      return true;
    });

    const sorted = [...filtered].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );

    return {
      items: sorted
        .slice(query.page * size, query.page * size + size)
        .map((item) => this.toRow(item, products)),
      total: filtered.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(item: StockMovement, search: string, products: ProductLite[]): boolean {
    const product = products.find((p) => p.id === item.productId);
    const haystack = [item.reason, item.date, product?.name ?? '', product?.sku ?? ''];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private toRow(item: StockMovement, products: ProductLite[]): StockMovementRow {
    const product = products.find((p) => p.id === item.productId);
    const warehouse = this.warehousesState().find((w) => w.id === item.warehouseId);

    return {
      ...item,
      productName: product?.name ?? item.productId,
      productSku: product?.sku ?? '',
      warehouseName: warehouse?.name ?? '',
    };
  }

  private fail(code: StockErrorCode): Observable<never> {
    return throwError(() => new StockError(code));
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

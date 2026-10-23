import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { StockError, StockService } from './stock.service';
import { MAIN_WAREHOUSE_ID, SECONDARY_WAREHOUSE_ID } from '../models/warehouse';

const MOUSE = 'a1000000-0000-4000-8000-000000000002';
const TONER = 'a1000000-0000-4000-8000-000000000009';
const CONSULT = 'a1000000-0000-4000-8000-000000000007';

describe('StockService', () => {
  let service: StockService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StockService);
  });

  it('aggregates seed movements into stock levels', async () => {
    const levels = await firstValueFrom(service.getLevels({ warehouseId: MAIN_WAREHOUSE_ID }));
    const mouse = levels.find((row) => row.productId === MOUSE);

    expect(mouse?.quantity).toBe(50);
  });

  it('splits quantities per warehouse', async () => {
    const all = await firstValueFrom(service.getLevels({}));
    const mouse = all.find((row) => row.productId === MOUSE);

    expect(mouse?.quantity).toBe(65);
  });

  it('creates an adjustment that changes the level', async () => {
    const created = await firstValueFrom(
      service.createAdjustment({
        direction: 'in',
        productId: MOUSE,
        warehouseId: MAIN_WAREHOUSE_ID,
        quantity: 5,
        date: '2026-10-22',
        reason: 'Found in back office',
      }),
    );

    expect(created.type).toBe('adjustment');
    expect(created.direction).toBe('in');

    const levels = await firstValueFrom(service.getLevels({ warehouseId: MAIN_WAREHOUSE_ID }));
    expect(levels.find((row) => row.productId === MOUSE)?.quantity).toBe(55);
  });

  it('rejects an adjustment on a service product', async () => {
    const promise = firstValueFrom(
      service.createAdjustment({
        direction: 'in',
        productId: CONSULT,
        warehouseId: MAIN_WAREHOUSE_ID,
        quantity: 1,
        date: '2026-10-22',
        reason: 'Test',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'notStockedProduct' });
  });

  it('rejects an adjustment without a reason', async () => {
    const promise = firstValueFrom(
      service.createAdjustment({
        direction: 'out',
        productId: MOUSE,
        warehouseId: MAIN_WAREHOUSE_ID,
        quantity: 1,
        date: '2026-10-22',
        reason: '  ',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'missingReason' });
  });

  it('moves quantity between warehouses with a transfer', async () => {
    const created = await firstValueFrom(
      service.createTransfer({
        productId: MOUSE,
        fromWarehouseId: MAIN_WAREHOUSE_ID,
        toWarehouseId: SECONDARY_WAREHOUSE_ID,
        quantity: 10,
        date: '2026-10-22',
        reason: 'Rebalance',
      }),
    );

    expect(created.length).toBe(2);
    expect(created[0].direction).toBe('out');
    expect(created[1].direction).toBe('in');

    const levels = await firstValueFrom(service.getLevels({}));
    expect(levels.find((row) => row.productId === MOUSE)?.quantity).toBe(65);
  });

  it('rejects a transfer between the same warehouse', async () => {
    const promise = firstValueFrom(
      service.createTransfer({
        productId: MOUSE,
        fromWarehouseId: MAIN_WAREHOUSE_ID,
        toWarehouseId: MAIN_WAREHOUSE_ID,
        quantity: 1,
        date: '2026-10-22',
        reason: 'Test',
      }),
    );

    await expect(promise).rejects.toMatchObject({ code: 'sameWarehouse' });
  });

  it('reports availability issues for insufficient stock', async () => {
    const issues = await firstValueFrom(
      service.checkAvailability(MAIN_WAREHOUSE_ID, [
        { productId: TONER, quantity: 100 },
        { productId: MOUSE, quantity: 1 },
      ]),
    );

    expect(issues).toEqual([{ productId: TONER, required: 100, available: 10 }]);
  });

  it('ignores service lines when checking availability', async () => {
    const issues = await firstValueFrom(
      service.checkAvailability(MAIN_WAREHOUSE_ID, [{ productId: CONSULT, quantity: 5 }]),
    );

    expect(issues).toEqual([]);
  });

  it('creates purchase movements and skips service lines', async () => {
    const created = await firstValueFrom(
      service.recordPurchaseReception({
        refId: 'order-1',
        date: '2026-10-22',
        warehouseId: MAIN_WAREHOUSE_ID,
        blNumber: 'BL-9000',
        items: [
          { productId: TONER, quantity: 4 },
          { productId: CONSULT, quantity: 5 },
        ],
      }),
    );

    expect(created.length).toBe(1);
    expect(created[0].type).toBe('purchase');
    expect(created[0].reason).toBe('BL-9000');
  });

  it('blocks sale posting when stock is insufficient', async () => {
    const promise = firstValueFrom(
      service.recordSalePosting({
        refId: 'invoice-1',
        date: '2026-10-22',
        warehouseId: MAIN_WAREHOUSE_ID,
        items: [{ productId: TONER, quantity: 999 }],
      }),
    );

    await expect(promise).rejects.toBeInstanceOf(StockError);
  });

  it('creates sale movements when stock is sufficient', async () => {
    const created = await firstValueFrom(
      service.recordSalePosting({
        refId: 'invoice-1',
        date: '2026-10-22',
        warehouseId: MAIN_WAREHOUSE_ID,
        items: [
          { productId: TONER, quantity: 3 },
          { productId: CONSULT, quantity: 2 },
        ],
      }),
    );

    expect(created.length).toBe(1);
    expect(created[0].type).toBe('sale');
    expect(created[0].direction).toBe('out');
  });

  it('rejects a duplicated warehouse code', async () => {
    const promise = firstValueFrom(service.createWarehouse({ code: 'main', name: 'Another main' }));

    await expect(promise).rejects.toMatchObject({ code: 'warehouseExists' });
  });

  it('refuses to archive the last active warehouse', async () => {
    await firstValueFrom(service.archiveWarehouse(MAIN_WAREHOUSE_ID));

    const promise = firstValueFrom(service.archiveWarehouse(SECONDARY_WAREHOUSE_ID));
    await expect(promise).rejects.toMatchObject({ code: 'lastActiveWarehouse' });
  });
});

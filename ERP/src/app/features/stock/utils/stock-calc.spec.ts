import { StockMovement } from '../models/stock-movement';
import { findAvailabilityIssues, levelFor, movementSignedQty } from './stock-calc';

function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id: 'sm-1',
    type: 'purchase',
    direction: 'in',
    productId: 'product-1',
    warehouseId: 'w1',
    quantity: 10,
    date: '2026-10-01',
    reason: '',
    refId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

describe('movementSignedQty', () => {
  it('keeps in movements positive and flips out movements', () => {
    expect(movementSignedQty(movement({ direction: 'in', quantity: 7 }))).toBe(7);
    expect(movementSignedQty(movement({ direction: 'out', quantity: 7 }))).toBe(-7);
  });
});

describe('levelFor', () => {
  const movements = [
    movement({ id: 'sm-1', direction: 'in', quantity: 30, warehouseId: 'w1', productId: 'p1' }),
    movement({ id: 'sm-2', direction: 'out', quantity: 5, warehouseId: 'w1', productId: 'p1' }),
    movement({ id: 'sm-3', direction: 'in', quantity: 12, warehouseId: 'w2', productId: 'p1' }),
    movement({ id: 'sm-4', direction: 'in', quantity: 4, warehouseId: 'w1', productId: 'p2' }),
  ];

  it('sums signed quantities per warehouse', () => {
    expect(levelFor(movements, 'w1', 'p1')).toBe(25);
    expect(levelFor(movements, 'w2', 'p1')).toBe(12);
  });

  it('sums across all warehouses when no warehouse is given', () => {
    expect(levelFor(movements, undefined, 'p1')).toBe(37);
  });

  it('returns 0 for a product with no movements', () => {
    expect(levelFor(movements, 'w1', 'p3')).toBe(0);
    expect(levelFor([], 'w1', 'p1')).toBe(0);
  });
});

describe('findAvailabilityIssues', () => {
  const movements = [
    movement({ id: 'sm-1', direction: 'in', quantity: 10, warehouseId: 'main', productId: 'p1' }),
    movement({ id: 'sm-2', direction: 'out', quantity: 4, warehouseId: 'main', productId: 'p1' }),
    movement({ id: 'sm-3', direction: 'in', quantity: 3, warehouseId: 'main', productId: 'p2' }),
  ];

  it('reports products where required quantity exceeds stock', () => {
    const issues = findAvailabilityIssues(movements, 'main', [
      { productId: 'p1', quantity: 7 },
      { productId: 'p2', quantity: 5 },
    ]);

    expect(issues).toEqual([
      { productId: 'p1', required: 7, available: 6 },
      { productId: 'p2', required: 5, available: 3 },
    ]);
  });

  it('aggregates several lines of the same product', () => {
    const issues = findAvailabilityIssues(movements, 'main', [
      { productId: 'p1', quantity: 3 },
      { productId: 'p1', quantity: 3 },
    ]);

    expect(issues).toEqual([]);
  });

  it('flags an aggregated demand larger than the stock', () => {
    const issues = findAvailabilityIssues(movements, 'main', [
      { productId: 'p1', quantity: 4 },
      { productId: 'p1', quantity: 3 },
    ]);

    expect(issues).toEqual([{ productId: 'p1', required: 7, available: 6 }]);
  });

  it('flags a product with no stock at all', () => {
    const issues = findAvailabilityIssues(movements, 'main', [{ productId: 'p9', quantity: 1 }]);

    expect(issues).toEqual([{ productId: 'p9', required: 1, available: 0 }]);
  });

  it('ignores zero and negative quantities', () => {
    const issues = findAvailabilityIssues(movements, 'main', [
      { productId: 'p1', quantity: 0 },
      { productId: 'p2', quantity: -3 },
    ]);

    expect(issues).toEqual([]);
  });

  it('checks availability only inside the requested warehouse', () => {
    const issues = findAvailabilityIssues(movements, 'other', [{ productId: 'p1', quantity: 1 }]);

    expect(issues).toEqual([{ productId: 'p1', required: 1, available: 0 }]);
  });
});

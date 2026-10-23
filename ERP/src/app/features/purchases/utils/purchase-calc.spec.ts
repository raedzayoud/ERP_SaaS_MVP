import { Product, ProductSupplierEntry } from '../../products/models/product';
import { PurchaseLine, PurchaseOrder } from '../models/purchase-order';
import {
  canReceive,
  catalogEntryFor,
  isCancellable,
  isEditable,
  isExpectedDateValid,
  isLate,
  isReceivable,
  lineNet,
  purchaseNumber,
  purchaseTotals,
  receptionState,
  remainingQty,
} from './purchase-calc';

function makeLine(overrides: Partial<PurchaseLine> = {}): PurchaseLine {
  return {
    id: 'line-1',
    productId: null,
    reference: 'SKU-1',
    description: 'Test line',
    unit: 'piece',
    quantity: 1,
    unitCost: 0,
    discountPct: 0,
    vatRate: 0,
    receivedQty: 0,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'order-1',
    number: null,
    status: 'draft',
    supplierId: 'supplier-1',
    supplierSnapshot: null,
    orderDate: '2026-10-01',
    expectedDate: '2026-10-31',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [makeLine()],
    receptions: [],
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    confirmedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('purchaseTotals', () => {
  it('computes net, VAT by rate and TTC for the reference example', () => {
    const lines = [
      makeLine({ id: 'l1', quantity: 50, unitCost: 15, vatRate: 19 }),
      makeLine({ id: 'l2', quantity: 20, unitCost: 8, vatRate: 7 }),
    ];

    const totals = purchaseTotals(lines, 'USD');

    expect(totals.totalNet).toBe(910);
    expect(totals.vatByRate).toEqual([
      { rate: 7, base: 160, vat: 11.2 },
      { rate: 19, base: 750, vat: 142.5 },
    ]);
    expect(totals.totalVat).toBe(153.7);
    expect(totals.totalTtc).toBe(1063.7);
  });

  it('applies the line discount before VAT', () => {
    const totals = purchaseTotals(
      [makeLine({ quantity: 2, unitCost: 100, discountPct: 10, vatRate: 20 })],
      'USD',
    );

    expect(totals.totalNet).toBe(180);
    expect(totals.totalVat).toBe(36);
    expect(totals.totalTtc).toBe(216);
  });

  it('rounds money to 3 decimals for TND', () => {
    const totals = purchaseTotals([makeLine({ quantity: 1, unitCost: 10, vatRate: 19 })], 'TND');

    expect(totals.totalVat).toBe(1.9);
    expect(totals.totalTtc).toBe(11.9);
  });
});

describe('lineNet', () => {
  it('returns the net amount of a line', () => {
    expect(lineNet(makeLine({ quantity: 3, unitCost: 10, discountPct: 10 }), 'USD')).toBe(27);
  });
});

describe('receptionState', () => {
  it('is none when nothing is received', () => {
    expect(receptionState([makeLine({ quantity: 5, receivedQty: 0 })])).toBe('none');
  });

  it('is partial when some quantity is received', () => {
    expect(receptionState([makeLine({ quantity: 5, receivedQty: 2 })])).toBe('partial');
  });

  it('is complete when every line is fully received', () => {
    expect(
      receptionState([
        makeLine({ id: 'l1', quantity: 5, receivedQty: 5 }),
        makeLine({ id: 'l2', quantity: 3, receivedQty: 3 }),
      ]),
    ).toBe('complete');
  });

  it('is none for an order without lines', () => {
    expect(receptionState([])).toBe('none');
  });
});

describe('remainingQty', () => {
  it('returns the quantity left to receive', () => {
    expect(remainingQty(makeLine({ quantity: 5, receivedQty: 2 }))).toBe(3);
  });

  it('never returns a negative value', () => {
    expect(remainingQty(makeLine({ quantity: 5, receivedQty: 7 }))).toBe(0);
  });
});

describe('canReceive', () => {
  const line = makeLine({ quantity: 10, receivedQty: 4 });

  it('rejects zero and negative quantities', () => {
    expect(canReceive(line, 0)).toBe(false);
    expect(canReceive(line, -1)).toBe(false);
  });

  it('rejects quantities above the remaining amount', () => {
    expect(canReceive(line, 7)).toBe(false);
  });

  it('accepts quantities up to the remaining amount', () => {
    expect(canReceive(line, 6)).toBe(true);
  });
});

describe('isLate', () => {
  it('is late for a confirmed order past its expected date', () => {
    const order = makeOrder({
      status: 'confirmed',
      expectedDate: '2026-10-15',
      lines: [makeLine({ quantity: 5, receivedQty: 1 })],
    });

    expect(isLate(order, '2026-10-22')).toBe(true);
  });

  it('is not late before the expected date', () => {
    const order = makeOrder({ status: 'confirmed', expectedDate: '2026-10-31' });

    expect(isLate(order, '2026-10-22')).toBe(false);
  });

  it('is not late for a draft or a fully received order', () => {
    const draft = makeOrder({ expectedDate: '2026-10-01' });
    const complete = makeOrder({
      status: 'confirmed',
      expectedDate: '2026-10-01',
      lines: [makeLine({ quantity: 2, receivedQty: 2 })],
    });

    expect(isLate(draft, '2026-10-22')).toBe(false);
    expect(isLate(complete, '2026-10-22')).toBe(false);
  });
});

describe('order state helpers', () => {
  it('only drafts are editable', () => {
    expect(isEditable(makeOrder({ status: 'draft' }))).toBe(true);
    expect(isEditable(makeOrder({ status: 'confirmed' }))).toBe(false);
    expect(isEditable(makeOrder({ status: 'cancelled' }))).toBe(false);
  });

  it('only confirmed orders without receptions can be cancelled', () => {
    expect(isCancellable(makeOrder({ status: 'confirmed' }))).toBe(true);
    expect(isCancellable(makeOrder({ status: 'draft' }))).toBe(false);
    expect(
      isCancellable(
        makeOrder({
          status: 'confirmed',
          receptions: [
            {
              id: 'rc-1',
              date: '2026-10-10',
              blNumber: 'BL-1',
              lines: [{ lineId: 'line-1', quantity: 1 }],
              createdAt: '2026-10-10T08:00:00.000Z',
            },
          ],
        }),
      ),
    ).toBe(false);
  });

  it('only confirmed orders that are not complete can be received', () => {
    expect(isReceivable(makeOrder({ status: 'confirmed' }))).toBe(true);
    expect(isReceivable(makeOrder({ status: 'draft' }))).toBe(false);
    expect(
      isReceivable(
        makeOrder({ status: 'confirmed', lines: [makeLine({ quantity: 2, receivedQty: 2 })] }),
      ),
    ).toBe(false);
  });
});

describe('purchaseNumber', () => {
  it('builds a padded BC number', () => {
    expect(purchaseNumber(2026, 7)).toBe('BC-2026-0007');
    expect(purchaseNumber(2026, 42)).toBe('BC-2026-0042');
  });
});

describe('isExpectedDateValid', () => {
  it('accepts the same day or a later date', () => {
    expect(isExpectedDateValid('2026-10-01', '2026-10-01')).toBe(true);
    expect(isExpectedDateValid('2026-10-01', '2026-10-15')).toBe(true);
    expect(isExpectedDateValid('2026-10-01', '2026-09-30')).toBe(false);
  });
});

function catalogEntry(overrides: Partial<ProductSupplierEntry> = {}): ProductSupplierEntry {
  return {
    id: 'ps-1',
    supplierId: 'supplier-1',
    supplierRef: 'REF-1',
    price: 10,
    minQty: 1,
    delayDays: 7,
    ...overrides,
  };
}

function productWithSuppliers(entries: ProductSupplierEntry[]): Product {
  return {
    id: 'product-1',
    sku: 'SKU-1',
    name: 'Test product',
    description: '',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 20,
    purchasePrice: 12,
    vatRate: 19,
    suppliers: entries,
    active: true,
    createdAt: '2026-01-01T08:00:00.000Z',
    updatedAt: '2026-01-01T08:00:00.000Z',
  };
}

describe('catalogEntryFor', () => {
  it('returns the entry of the selected supplier', () => {
    const product = productWithSuppliers([
      catalogEntry({ supplierId: 's1', price: 14 }),
      catalogEntry({ id: 'ps-2', supplierId: 's2', price: 16 }),
    ]);

    expect(catalogEntryFor(product, 's1')?.price).toBe(14);
    expect(catalogEntryFor(product, 's2')?.price).toBe(16);
  });

  it('returns the cheapest entry when a supplier has several', () => {
    const product = productWithSuppliers([
      catalogEntry({ id: 'ps-1', price: 15, minQty: 10 }),
      catalogEntry({ id: 'ps-2', price: 13, minQty: 50 }),
    ]);

    expect(catalogEntryFor(product, 'supplier-1')?.price).toBe(13);
  });

  it('returns undefined when the supplier is unknown for this product', () => {
    const product = productWithSuppliers([catalogEntry({ supplierId: 's1' })]);

    expect(catalogEntryFor(product, 's2')).toBeUndefined();
    expect(catalogEntryFor(productWithSuppliers([]), 's1')).toBeUndefined();
    expect(catalogEntryFor(undefined, 's1')).toBeUndefined();
    expect(catalogEntryFor(product, '')).toBeUndefined();
  });
});

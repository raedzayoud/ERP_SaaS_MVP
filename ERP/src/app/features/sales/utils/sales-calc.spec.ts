import { SalesLine, SalesOrder } from '../models/sales-order';
import {
  isCancellable,
  isEditable,
  isExpectedDateValid,
  isInvoiceable,
  isLate,
  lineNet,
  salesNumber,
  salesTotals,
} from './sales-calc';

function makeLine(overrides: Partial<SalesLine> = {}): SalesLine {
  return {
    id: 'line-1',
    productId: null,
    reference: 'SKU-1',
    description: 'Test line',
    unit: 'piece',
    quantity: 1,
    unitPrice: 0,
    discountPct: 0,
    vatRate: 0,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'order-1',
    number: null,
    status: 'draft',
    customerId: 'customer-1',
    customerSnapshot: null,
    orderDate: '2026-10-01',
    expectedDate: '2026-10-31',
    paymentTerms: 'net30',
    currency: 'USD',
    notes: '',
    lines: [makeLine()],
    invoiceId: null,
    deliveryNoteId: null,
    originQuoteId: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    confirmedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

describe('salesTotals', () => {
  it('computes net, VAT by rate and TTC for the reference example', () => {
    const lines = [
      makeLine({ id: 'l1', quantity: 50, unitPrice: 25, vatRate: 19 }),
      makeLine({ id: 'l2', quantity: 20, unitPrice: 12, vatRate: 7 }),
    ];

    const totals = salesTotals(lines, 'USD');

    expect(totals.totalNet).toBe(1490);
    expect(totals.vatByRate).toEqual([
      { rate: 7, base: 240, vat: 16.8 },
      { rate: 19, base: 1250, vat: 237.5 },
    ]);
    expect(totals.totalVat).toBe(254.3);
    expect(totals.totalTtc).toBe(1744.3);
  });

  it('applies the line discount before VAT', () => {
    const totals = salesTotals(
      [makeLine({ quantity: 2, unitPrice: 100, discountPct: 10, vatRate: 20 })],
      'USD',
    );

    expect(totals.totalNet).toBe(180);
    expect(totals.totalVat).toBe(36);
    expect(totals.totalTtc).toBe(216);
  });

  it('rounds money to 3 decimals for TND', () => {
    const totals = salesTotals([makeLine({ quantity: 1, unitPrice: 10, vatRate: 19 })], 'TND');

    expect(totals.totalVat).toBe(1.9);
    expect(totals.totalTtc).toBe(11.9);
  });
});

describe('lineNet', () => {
  it('returns the net amount of a line', () => {
    expect(lineNet(makeLine({ quantity: 3, unitPrice: 10, discountPct: 10 }), 'USD')).toBe(27);
  });
});

describe('isEditable', () => {
  it('is true only for drafts', () => {
    expect(isEditable(makeOrder())).toBe(true);
    expect(isEditable(makeOrder({ status: 'confirmed' }))).toBe(false);
    expect(isEditable(makeOrder({ status: 'cancelled' }))).toBe(false);
  });
});

describe('isCancellable', () => {
  it('is true for a confirmed order without invoice', () => {
    expect(isCancellable(makeOrder({ status: 'confirmed' }))).toBe(true);
  });

  it('is false once the order is invoiced', () => {
    expect(isCancellable(makeOrder({ status: 'confirmed', invoiceId: 'invoice-1' }))).toBe(false);
  });

  it('is false for drafts and cancelled orders', () => {
    expect(isCancellable(makeOrder())).toBe(false);
    expect(isCancellable(makeOrder({ status: 'cancelled' }))).toBe(false);
  });
});

describe('isInvoiceable', () => {
  it('is true for a confirmed order with lines and no invoice', () => {
    expect(isInvoiceable(makeOrder({ status: 'confirmed' }))).toBe(true);
  });

  it('is false when the order is already invoiced', () => {
    expect(isInvoiceable(makeOrder({ status: 'confirmed', invoiceId: 'invoice-1' }))).toBe(false);
  });

  it('is false for drafts, cancelled orders and empty orders', () => {
    expect(isInvoiceable(makeOrder())).toBe(false);
    expect(isInvoiceable(makeOrder({ status: 'cancelled' }))).toBe(false);
    expect(isInvoiceable(makeOrder({ status: 'confirmed', lines: [] }))).toBe(false);
  });
});

describe('isLate', () => {
  it('is true when a confirmed uninvoiced order is past its expected date', () => {
    expect(isLate(makeOrder({ status: 'confirmed', expectedDate: '2026-10-15' }), '2026-10-20')).toBe(
      true,
    );
  });

  it('is false before the expected date', () => {
    expect(isLate(makeOrder({ status: 'confirmed', expectedDate: '2026-10-25' }), '2026-10-20')).toBe(
      false,
    );
  });

  it('is false once the order is invoiced', () => {
    expect(
      isLate(
        makeOrder({ status: 'confirmed', expectedDate: '2026-10-15', invoiceId: 'invoice-1' }),
        '2026-10-20',
      ),
    ).toBe(false);
  });

  it('is false for drafts and cancelled orders', () => {
    expect(isLate(makeOrder({ expectedDate: '2026-10-15' }), '2026-10-20')).toBe(false);
    expect(isLate(makeOrder({ status: 'cancelled', expectedDate: '2026-10-15' }), '2026-10-20')).toBe(
      false,
    );
  });
});

describe('isExpectedDateValid', () => {
  it('accepts the same day or a later date', () => {
    expect(isExpectedDateValid('2026-10-01', '2026-10-01')).toBe(true);
    expect(isExpectedDateValid('2026-10-01', '2026-10-15')).toBe(true);
  });

  it('rejects a date before the order date', () => {
    expect(isExpectedDateValid('2026-10-01', '2026-09-30')).toBe(false);
  });
});

describe('salesNumber', () => {
  it('formats the number with the CMD prefix and 4 digits', () => {
    expect(salesNumber(2026, 1)).toBe('CMD-2026-0001');
  });

  it('pads larger sequences', () => {
    expect(salesNumber(2026, 42)).toBe('CMD-2026-0042');
  });
});

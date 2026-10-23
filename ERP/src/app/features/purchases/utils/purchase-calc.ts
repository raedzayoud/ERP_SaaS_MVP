import {
  LineLike,
  LineTotals,
  VatGroup,
  lineTotals,
  todayIso,
  totalsFor,
} from '../../../shared/utils/money';
import { Product, ProductSupplierEntry } from '../../products/models/product';
import { PurchaseLine, PurchaseOrder, ReceptionState } from '../models/purchase-order';

export interface PurchaseTotals {
  lines: LineTotals[];
  totalNet: number;
  vatByRate: VatGroup[];
  totalVat: number;
  totalTtc: number;
}

export function toLineLike(line: PurchaseLine): LineLike {
  return {
    quantity: line.quantity,
    unitPrice: line.unitCost,
    discountPct: line.discountPct,
    vatRate: line.vatRate,
  };
}

export function lineNet(line: PurchaseLine, currency: string): number {
  return lineTotals(toLineLike(line), currency).net;
}

export function purchaseTotals(lines: PurchaseLine[], currency: string): PurchaseTotals {
  return totalsFor(lines.map(toLineLike), currency);
}

export function remainingQty(line: PurchaseLine): number {
  return Math.max(0, line.quantity - line.receivedQty);
}

export function receptionState(lines: PurchaseLine[]): ReceptionState {
  let total = 0;
  let received = 0;

  for (const line of lines) {
    total += line.quantity;
    received += Math.min(line.receivedQty, line.quantity);
  }

  if (total <= 0 || received <= 0) return 'none';
  return received >= total ? 'complete' : 'partial';
}

export function isEditable(order: PurchaseOrder): boolean {
  return order.status === 'draft';
}

export function isCancellable(order: PurchaseOrder): boolean {
  return order.status === 'confirmed' && order.receptions.length === 0;
}

export function isReceivable(order: PurchaseOrder): boolean {
  return order.status === 'confirmed' && receptionState(order.lines) !== 'complete';
}

export function isLate(order: PurchaseOrder, today = todayIso()): boolean {
  return (
    order.status === 'confirmed' &&
    order.expectedDate < today &&
    receptionState(order.lines) !== 'complete'
  );
}

export function canReceive(line: PurchaseLine, quantity: number): boolean {
  return quantity > 0 && quantity <= remainingQty(line);
}

export function isExpectedDateValid(orderDate: string, expectedDate: string): boolean {
  return expectedDate >= orderDate;
}

export function purchaseNumber(year: number, sequence: number): string {
  return `BC-${year}-${String(sequence).padStart(4, '0')}`;
}

export function catalogEntryFor(
  product: Product | undefined,
  supplierId: string,
): ProductSupplierEntry | undefined {
  if (!product || !supplierId) return undefined;

  const entries = product.suppliers.filter((entry) => entry.supplierId === supplierId);
  if (entries.length === 0) return undefined;

  return entries.reduce((best, entry) => (entry.price < best.price ? entry : best));
}

import {
  LineLike,
  LineTotals,
  VatGroup,
  lineTotals,
  todayIso,
  totalsFor,
} from '../../../shared/utils/money';
import { SalesLine, SalesOrder } from '../models/sales-order';

export interface SalesTotals {
  lines: LineTotals[];
  totalNet: number;
  vatByRate: VatGroup[];
  totalVat: number;
  totalTtc: number;
}

export function toLineLike(line: SalesLine): LineLike {
  return {
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPct: line.discountPct,
    vatRate: line.vatRate,
  };
}

export function lineNet(line: SalesLine, currency: string): number {
  return lineTotals(toLineLike(line), currency).net;
}

export function salesTotals(lines: SalesLine[], currency: string): SalesTotals {
  return totalsFor(lines.map(toLineLike), currency);
}

export function isEditable(order: SalesOrder): boolean {
  return order.status === 'draft';
}

export function isCancellable(order: SalesOrder): boolean {
  return (
    order.status === 'confirmed' &&
    order.invoiceId === null &&
    order.deliveryNoteId === null
  );
}

export function isInvoiceable(order: SalesOrder): boolean {
  return (
    order.status === 'confirmed' &&
    order.invoiceId === null &&
    order.deliveryNoteId === null &&
    order.lines.length > 0
  );
}

export function isLate(order: SalesOrder, today = todayIso()): boolean {
  return (
    order.status === 'confirmed' &&
    order.invoiceId === null &&
    order.expectedDate < today
  );
}

export function isExpectedDateValid(orderDate: string, expectedDate: string): boolean {
  return expectedDate >= orderDate;
}

export function salesNumber(year: number, sequence: number): string {
  return `CMD-${year}-${String(sequence).padStart(4, '0')}`;
}

import { LineLike, totalsFor } from '../../../shared/utils/money';
import { BillLine, BillState } from '../models/supplier-bill';

export function toBillLineLike(line: BillLine): LineLike {
  return {
    quantity: line.quantity,
    unitPrice: line.unitCost,
    discountPct: 0,
    vatRate: line.vatRate,
  };
}

export function billTotals(lines: BillLine[], currency: string): ReturnType<typeof totalsFor> {
  return totalsFor(lines.map(toBillLineLike), currency);
}

/** The bill state is computed from what was already paid, not stored. */
export function billState(paid: number, totalTtc: number): BillState {
  if (paid <= 0) return 'unpaid';
  return paid >= totalTtc - 0.005 ? 'paid' : 'partial';
}

export function billNumber(year: number, sequence: number): string {
  return `FA-${year}-${String(sequence).padStart(4, '0')}`;
}

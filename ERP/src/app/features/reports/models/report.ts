export interface SalesByMonth {
  month: string;
  label: string;
  total: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface PaymentsByMode {
  mode: string;
  count: number;
  total: number;
}

export interface MarginRow {
  productId: string;
  name: string;
  quantity: number;
  margin: number;
}

export interface TrialBalanceRow {
  code: string;
  debit: number;
  credit: number;
  balance: number;
}

/** Aging bucket of an unpaid supplier bill (days late). */
export type AgingBucket = 'b0' | 'b31' | 'b61' | 'b90';

export interface AgingRow {
  bucket: AgingBucket;
  count: number;
  total: number;
}

export interface CustomerRow {
  partnerId: string;
  name: string;
  invoices: number;
  revenue: number;
}

export interface StockRow {
  productId: string;
  name: string;
  quantity: number;
  minStock: number;
  low: boolean;
}

export interface ReportData {
  salesByMonth: SalesByMonth[];
  topProducts: TopProduct[];
  paymentsByMode: PaymentsByMode[];
  margins: MarginRow[];
  trialBalance: TrialBalanceRow[];
  aging: AgingRow[];
  customers: CustomerRow[];
  stockRows: StockRow[];
  totalSales: number;
  totalExpenses: number;
  stockValue: number;
  outstanding: number;
  overdue: number;
}

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

export interface ReportData {
  salesByMonth: SalesByMonth[];
  topProducts: TopProduct[];
  paymentsByMode: PaymentsByMode[];
  margins: MarginRow[];
  trialBalance: TrialBalanceRow[];
  totalSales: number;
  totalExpenses: number;
  stockValue: number;
  outstanding: number;
  overdue: number;
}

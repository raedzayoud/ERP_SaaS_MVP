export type JournalCode = 'SALES' | 'PURCHASES' | 'PAYMENTS' | 'STOCK';

export type AccountType = 'asset' | 'liability' | 'revenue' | 'expense';

export interface Account {
  code: string;
  type: AccountType;
}

export interface JournalLine {
  id: string;
  accountCode: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  journal: JournalCode;
  ref: string;
  label: string;
  lines: JournalLine[];
  currency: string;
}

export interface JournalQuery {
  page: number;
  size: number;
  journal?: JournalCode;
  from?: string;
  to?: string;
  search?: string;
  sort?: string;
}

export interface TrialBalanceRow {
  code: string;
  debit: number;
  credit: number;
  balance: number;
}

export const JOURNAL_CODES: JournalCode[] = ['SALES', 'PURCHASES', 'PAYMENTS', 'STOCK'];

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'revenue', 'expense'];

export const CHART_OF_ACCOUNTS: Account[] = [
  { code: '411000', type: 'asset' },
  { code: '401000', type: 'liability' },
  { code: '701000', type: 'revenue' },
  { code: '706000', type: 'revenue' },
  { code: '445710', type: 'liability' },
  { code: '445660', type: 'asset' },
  { code: '512000', type: 'asset' },
  { code: '530000', type: 'asset' },
  { code: '310000', type: 'asset' },
  { code: '601000', type: 'expense' },
  { code: '793000', type: 'revenue' },
  { code: '693000', type: 'expense' },
];

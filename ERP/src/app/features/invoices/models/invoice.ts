import { PaymentTerms } from '../../../shared/models/payment-terms';

export type InvoiceKind = 'invoice' | 'credit_note' | 'quote';
export type InvoiceStatus = 'draft' | 'posted' | 'cancelled';
export type PaymentState = 'none' | 'unpaid' | 'partial' | 'paid';

export interface CustomerSnapshot {
  name: string;
  taxId: string;
  address: string;
}

export interface InvoiceLine {
  id: string;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
}

export type InvoiceLineInput = Omit<InvoiceLine, 'id'>;

export interface Invoice {
  id: string;
  number: string | null;
  kind: InvoiceKind;
  status: InvoiceStatus;
  customerId: string;
  customerSnapshot: CustomerSnapshot | null;
  issueDate: string;
  dueDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  lines: InvoiceLine[];
  stampDuty: number;
  amountPaid: number;
  notes: string;
  originInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
}

export interface InvoiceDraftInput {
  id: string | null;
  kind: InvoiceKind;
  customerId: string;
  issueDate: string;
  dueDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  stampDuty: number;
  notes: string;
  originInvoiceId: string | null;
  lines: InvoiceLineInput[];
}

export interface InvoiceQuery {
  page: number;
  size: number;
  search?: string;
  status?: InvoiceStatus;
  kinds?: InvoiceKind[];
  paid?: 'unpaid' | 'partial' | 'paid';
  from?: string;
  to?: string;
  sort?: string;
}

export interface InvoiceSummary {
  outstanding: number;
  overdue: number;
}

export const NUMBER_PREFIX: Record<InvoiceKind, string> = {
  invoice: 'FAC',
  credit_note: 'AV',
  quote: 'DEV',
};

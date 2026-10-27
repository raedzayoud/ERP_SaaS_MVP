import { PaymentTerms } from '../../../shared/models/payment-terms';

export type SalesStatus = 'draft' | 'confirmed' | 'cancelled';

export interface CustomerSnapshot {
  name: string;
  taxId: string;
  address: string;
}

export interface SalesLine {
  id: string;
  productId: string | null;
  reference: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
}

export type SalesLineInput = Omit<SalesLine, 'id'>;

export interface SalesOrder {
  id: string;
  number: string | null;
  status: SalesStatus;
  customerId: string;
  customerSnapshot: CustomerSnapshot | null;
  orderDate: string;
  expectedDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  notes: string;
  lines: SalesLine[];
  invoiceId: string | null;
  deliveryNoteId: string | null;
  originQuoteId: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface SalesDraftInput {
  id: string | null;
  customerId: string;
  orderDate: string;
  expectedDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  notes: string;
  lines: SalesLineInput[];
}

export interface SalesQuery {
  page: number;
  size: number;
  search?: string;
  status?: SalesStatus;
  customerId?: string;
  sort?: string;
}

export interface SalesSummary {
  awaiting: number;
  late: number;
}

export const SALES_NUMBER_PREFIX = 'CMD';

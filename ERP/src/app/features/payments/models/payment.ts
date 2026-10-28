export type PaymentMode = 'cash' | 'check' | 'transfer' | 'card';

/** 'in' = a customer pays us, 'out' = we pay a supplier. */
export type PaymentDirection = 'in' | 'out';

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  partnerId: string;
  partnerName: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  currency: string;
  notes: string;
  direction: PaymentDirection;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInput {
  invoiceId: string;
  date: string;
  amount: number;
  mode: PaymentMode;
  reference: string;
  notes: string;
}

export interface SupplierBillPayer {
  id: string;
  number: string;
  supplierId: string;
  supplierName: string;
  currency: string;
}

export interface PaymentQuery {
  page: number;
  size: number;
  search?: string;
  mode?: PaymentMode;
  direction?: PaymentDirection;
  from?: string;
  to?: string;
  sort?: string;
}

export const PAYMENT_MODES: PaymentMode[] = ['cash', 'check', 'transfer', 'card'];

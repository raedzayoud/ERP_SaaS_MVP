export type PaymentMode = 'cash' | 'check' | 'transfer' | 'card';

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

export interface PaymentQuery {
  page: number;
  size: number;
  search?: string;
  mode?: PaymentMode;
  from?: string;
  to?: string;
  sort?: string;
}

export const PAYMENT_MODES: PaymentMode[] = ['cash', 'check', 'transfer', 'card'];

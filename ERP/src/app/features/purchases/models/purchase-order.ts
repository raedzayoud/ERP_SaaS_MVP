import { PaymentTerms } from '../../../shared/models/payment-terms';

export type PurchaseStatus = 'draft' | 'confirmed' | 'cancelled';
export type ReceptionState = 'none' | 'partial' | 'complete';

export interface SupplierSnapshot {
  name: string;
  taxId: string;
  address: string;
}

export interface PurchaseLine {
  id: string;
  productId: string | null;
  reference: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  discountPct: number;
  vatRate: number;
  receivedQty: number;
}

export type PurchaseLineInput = Omit<PurchaseLine, 'id' | 'receivedQty'>;

export interface ReceptionLine {
  lineId: string;
  quantity: number;
}

export interface Reception {
  id: string;
  date: string;
  blNumber: string;
  lines: ReceptionLine[];
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  number: string | null;
  status: PurchaseStatus;
  supplierId: string;
  supplierSnapshot: SupplierSnapshot | null;
  orderDate: string;
  expectedDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  notes: string;
  lines: PurchaseLine[];
  receptions: Reception[];
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
}

export interface PurchaseDraftInput {
  id: string | null;
  supplierId: string;
  orderDate: string;
  expectedDate: string;
  paymentTerms: PaymentTerms;
  currency: string;
  notes: string;
  lines: PurchaseLineInput[];
}

export interface ReceiveInput {
  date: string;
  blNumber: string;
  warehouseId: string;
  items: ReceptionLine[];
}

export interface PurchaseQuery {
  page: number;
  size: number;
  search?: string;
  status?: PurchaseStatus;
  sort?: string;
}

export interface PurchaseSummary {
  awaiting: number;
  late: number;
}

export const PURCHASE_NUMBER_PREFIX = 'BC';

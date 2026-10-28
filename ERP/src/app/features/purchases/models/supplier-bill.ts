import { SupplierSnapshot } from './purchase-order';

/** Payment state of a supplier bill, always computed (never stored). */
export type BillState = 'unpaid' | 'partial' | 'paid';

/** Where the bill comes from: an order reception or a free standalone bill. */
export type BillSource = 'order' | 'standalone';

export interface BillLine {
  lineId: string;
  productId: string | null;
  reference: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  vatRate: number;
}

export type BillLineInput = Omit<BillLine, 'lineId'>;

export interface SupplierBill {
  id: string;
  number: string;
  sourceType: BillSource;
  orderId: string | null;
  orderNumber: string | null;
  supplierId: string;
  supplierSnapshot: SupplierSnapshot | null;
  billingDate: string;
  dueDate: string;
  currency: string;
  notes: string;
  lines: BillLine[];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierBillInput {
  id: null;
  supplierId: string;
  billingDate: string;
  dueDate: string;
  notes: string;
  lines: BillLineInput[];
}

/** Extra info the page provides when a bill is issued from an order. */
export interface BillFromOrderInput {
  orderId: string;
  billingDate: string;
  dueDate: string;
  notes: string;
}

export interface SupplierBillQuery {
  page: number;
  size: number;
  search?: string;
  supplierId?: string;
  state?: BillState;
  sort?: string;
}

import { CustomerSnapshot } from './sales-order';

export type DeliveryErrorCode =
  | 'orderNotFound'
  | 'orderNotConfirmed'
  | 'alreadyDelivered'
  | 'notFound'
  | 'originMissing'
  | 'alreadyInvoiced'
  | 'insufficientStock';

export class DeliveryError extends Error {
  constructor(readonly code: DeliveryErrorCode) {
    super(code);
  }
}

export interface DeliveryNoteLine {
  productId: string;
  reference: string;
  description: string;
  unit: string;
  quantity: number;
}

export interface DeliveryNote {
  id: string;
  deliveryNumber: string;
  salesOrderId: string;
  salesOrderNumber: string | null;
  customer: CustomerSnapshot;
  deliveryDate: string;
  warehouseId: string;
  lines: DeliveryNoteLine[];
  notes: string;
  status: 'issued';
  createdAt: string;
}

export interface DeliveryInput {
  salesOrderId: string;
  warehouseId: string;
  deliveryDate: string;
  notes?: string;
}

export interface DeliveryQuery {
  search?: string;
  from?: string;
  to?: string;
  sort?: string;
}

export const DELIVERY_NUMBER_PREFIX = 'BL';

export function deliveryNumber(year: number, sequence: number): string {
  return `${DELIVERY_NUMBER_PREFIX}-${year}-${String(sequence).padStart(4, '0')}`;
}

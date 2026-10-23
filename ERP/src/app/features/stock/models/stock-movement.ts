export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'transfer';
export type MovementDirection = 'in' | 'out';

export interface StockMovement {
  id: string;
  type: MovementType;
  direction: MovementDirection;
  productId: string;
  warehouseId: string;
  quantity: number;
  date: string;
  reason: string;
  refId: string | null;
  createdAt: string;
}

export interface StockMovementRow extends StockMovement {
  productName: string;
  productSku: string;
  warehouseName: string;
}

export interface StockLevelRow {
  productId: string;
  sku: string;
  name: string;
  unit: string;
  purchasePrice: number;
  quantity: number;
  value: number;
}

export interface StockLevelQuery {
  warehouseId?: string;
  search?: string;
}

export interface StockMovementQuery {
  page: number;
  size: number;
  search?: string;
  type?: MovementType;
  warehouseId?: string;
  sort?: string;
}

export interface AdjustmentInput {
  direction: MovementDirection;
  productId: string;
  warehouseId: string;
  quantity: number;
  date: string;
  reason: string;
}

export interface TransferInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  date: string;
  reason: string;
}

export interface SalePostingInput {
  refId: string;
  date: string;
  warehouseId: string;
  items: { productId: string; quantity: number }[];
}

export interface ReceptionPostingInput {
  refId: string;
  date: string;
  warehouseId: string;
  blNumber: string;
  items: { productId: string; quantity: number }[];
}

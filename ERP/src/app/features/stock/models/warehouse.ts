export interface Warehouse {
  id: string;
  code: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseInput {
  code: string;
  name: string;
}

export interface WarehouseNameInput {
  name: string;
}

/** Small stats block shown on the warehouses page. */
export interface WarehouseSummary {
  warehouseId: string;
  /** Products currently stored (non-zero quantity). */
  refs: number;
  /** Storage value of the warehouse. */
  value: number;
}

export const MAIN_WAREHOUSE_ID = 'w1000000-0000-4000-8000-000000000001';
export const SECONDARY_WAREHOUSE_ID = 'w1000000-0000-4000-8000-000000000002';

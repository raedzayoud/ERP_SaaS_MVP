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

export const MAIN_WAREHOUSE_ID = 'w1000000-0000-4000-8000-000000000001';
export const SECONDARY_WAREHOUSE_ID = 'w1000000-0000-4000-8000-000000000002';

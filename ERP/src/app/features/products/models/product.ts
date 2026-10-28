export type ProductType = 'good' | 'service';

export interface ProductSupplierEntry {
  id: string;
  supplierId: string;
  supplierRef: string;
  price: number;
  minQty: number;
  delayDays: number;
}

export type ProductSupplierEntryInput = Omit<ProductSupplierEntry, 'id'>;

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  type: ProductType;
  unit: string;
  category: string;
  salePrice: number;
  purchasePrice: number;
  vatRate: number;
  /** Stock threshold for the low-stock report; only goods need it. */
  minStock?: number;
  suppliers: ProductSupplierEntry[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Omit<
  Product,
  'id' | 'createdAt' | 'updatedAt' | 'active' | 'suppliers'
> & { suppliers: ProductSupplierEntryInput[] };

export interface ProductQuery {
  page: number;
  size: number;
  search?: string;
  type?: ProductType;
  category?: string;
  active?: boolean;
  sort?: string;
}

export interface ProductOption {
  code: string;
}

export const PRODUCT_CATEGORIES: ProductOption[] = [
  { code: 'hardware' },
  { code: 'services' },
  { code: 'consumables' },
  { code: 'other' },
];

export const PRODUCT_UNITS: ProductOption[] = [
  { code: 'piece' },
  { code: 'hour' },
  { code: 'day' },
  { code: 'kg' },
  { code: 'litre' },
  { code: 'box' },
  { code: 'month' },
];

export const PRODUCT_VAT_RATES = [0, 5.5, 7, 10, 13, 19, 20];

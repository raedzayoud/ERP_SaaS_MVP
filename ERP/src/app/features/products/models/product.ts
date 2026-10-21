export type ProductType = 'good' | 'service';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  type: ProductType;
  unit: string;
  category: string;
  salePrice: number;
  vatRate: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'active'>;

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

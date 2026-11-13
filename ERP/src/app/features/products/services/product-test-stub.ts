import { Provider } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { Product, ProductInput, ProductQuery } from '../models/product';
import { ProductService } from './product.service';

const NORD = 'f4a1c2e0-8a01-4a10-9d21-000000000003';
const VERDE = 'f4a1c2e0-8a01-4a10-9d21-000000000007';

/**
 * The demo catalog the mock features (invoices, sales, purchases, reports)
 * still refer to by id. The application itself reads the real API.
 */
export const TEST_PRODUCTS: Product[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    sku: 'SKU-1001',
    name: 'Laptop Pro 14',
    description: '14 inch business laptop.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 1299,
    purchasePrice: 900,
    vatRate: 19,
    minStock: 6,
    suppliers: [
      { id: 'ps-1001', supplierId: VERDE, supplierRef: 'VRD-LP14', price: 900, minQty: 1, delayDays: 14 },
    ],
    active: true,
    createdAt: '2026-01-08T10:00:00.000Z',
    updatedAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    sku: 'SKU-1002',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 24.9,
    purchasePrice: 15,
    vatRate: 19,
    minStock: 70,
    suppliers: [
      { id: 'ps-1002', supplierId: NORD, supplierRef: 'NRD-MSE-14', price: 15, minQty: 10, delayDays: 7 },
    ],
    active: true,
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: '2026-01-15T09:30:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    sku: 'SKU-1003',
    name: 'USB-C Docking Station',
    description: 'Dual display docking station.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 189,
    purchasePrice: 120,
    vatRate: 19,
    suppliers: [
      { id: 'ps-1004', supplierId: VERDE, supplierRef: 'VRD-DOCK-C', price: 120, minQty: 1, delayDays: 14 },
    ],
    active: true,
    createdAt: '2026-02-02T14:20:00.000Z',
    updatedAt: '2026-02-02T14:20:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    sku: 'SKU-1004',
    name: 'Refurbished Desktop',
    description: 'Desktop workstation, refurbished.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 540,
    purchasePrice: 320,
    vatRate: 19,
    suppliers: [],
    active: false,
    createdAt: '2026-02-11T11:45:00.000Z',
    updatedAt: '2026-03-19T11:45:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000005',
    sku: 'SKU-2001',
    name: 'Installation Service',
    description: 'On-site installation and configuration.',
    type: 'service',
    unit: 'hour',
    category: 'services',
    salePrice: 60,
    purchasePrice: 35,
    vatRate: 13,
    suppliers: [],
    active: true,
    createdAt: '2026-02-20T08:15:00.000Z',
    updatedAt: '2026-02-20T08:15:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000006',
    sku: 'SKU-2002',
    name: 'Monthly Support',
    description: 'Remote support subscription.',
    type: 'service',
    unit: 'month',
    category: 'services',
    salePrice: 150,
    purchasePrice: 90,
    vatRate: 19,
    suppliers: [],
    active: true,
    createdAt: '2026-03-01T16:00:00.000Z',
    updatedAt: '2026-03-01T16:00:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000007',
    sku: 'SKU-2003',
    name: 'Consulting Day',
    description: 'Expert consulting, billed per day.',
    type: 'service',
    unit: 'day',
    category: 'services',
    salePrice: 720,
    purchasePrice: 450,
    vatRate: 7,
    suppliers: [],
    active: true,
    createdAt: '2026-03-12T13:10:00.000Z',
    updatedAt: '2026-03-12T13:10:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000008',
    sku: 'SKU-3001',
    name: 'Printer Paper A4',
    description: '80 gsm white paper, 500 sheets per ream.',
    type: 'good',
    unit: 'box',
    category: 'consumables',
    salePrice: 12.5,
    purchasePrice: 8,
    vatRate: 7,
    minStock: 25,
    suppliers: [
      { id: 'ps-1005', supplierId: NORD, supplierRef: 'NRD-PAP-A4', price: 8, minQty: 20, delayDays: 7 },
    ],
    active: true,
    createdAt: '2026-03-21T10:40:00.000Z',
    updatedAt: '2026-03-21T10:40:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000009',
    sku: 'SKU-3002',
    name: 'Toner Cartridge',
    description: 'Black toner cartridge.',
    type: 'good',
    unit: 'piece',
    category: 'consumables',
    salePrice: 78,
    purchasePrice: 60,
    vatRate: 19,
    minStock: 15,
    suppliers: [
      { id: 'ps-1006', supplierId: NORD, supplierRef: 'NRD-TNR-BK', price: 60, minQty: 5, delayDays: 7 },
    ],
    active: true,
    createdAt: '2026-04-04T15:25:00.000Z',
    updatedAt: '2026-04-04T15:25:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000010',
    sku: 'SKU-9001',
    name: 'Legacy Licence',
    description: 'Old subscription kept for historical invoices.',
    type: 'service',
    unit: 'month',
    category: 'other',
    salePrice: 25,
    purchasePrice: 10,
    vatRate: 0,
    suppliers: [],
    active: false,
    createdAt: '2026-04-18T09:05:00.000Z',
    updatedAt: '2026-05-06T09:05:00.000Z',
  },
];

export function createProductStub() {
  return {
    getProducts: (query: ProductQuery): Observable<Page<Product>> => {
      const search = query.search?.trim().toLowerCase();
      const items = TEST_PRODUCTS.filter(
        (product) =>
          (query.type === undefined || product.type === query.type) &&
          (query.category === undefined || product.category === query.category) &&
          (query.active === undefined || product.active === query.active) &&
          (!search ||
            product.name.toLowerCase().includes(search) ||
            product.sku.toLowerCase().includes(search)),
      );
      return of({ items, total: items.length, page: query.page, size: query.size });
    },
    getProduct: (id: string): Observable<Product | undefined> =>
      of(TEST_PRODUCTS.find((product) => product.id === id)),
    createProduct: (data: ProductInput): Observable<Product> =>
      of({
        ...data,
        id: 'p-new',
        active: true,
        createdAt: '',
        updatedAt: '',
        suppliers: data.suppliers.map((supplier, index) => ({
          ...supplier,
          id: `ps-new-${index}`,
        })),
      }),
    updateProduct: (id: string, data: ProductInput): Observable<Product> =>
      of({
        ...data,
        id,
        active: true,
        createdAt: '',
        updatedAt: '',
        suppliers: data.suppliers.map((supplier, index) => ({
          ...supplier,
          id: `ps-${index}`,
        })),
      }),
    archiveProduct: (id: string): Observable<Product> =>
      of({ ...(TEST_PRODUCTS[0] as Product), id, active: false }),
    restoreProduct: (id: string): Observable<Product> =>
      of({ ...(TEST_PRODUCTS[0] as Product), id, active: true }),
  };
}

export function productServiceStub(): Provider {
  return { provide: ProductService, useValue: createProductStub() };
}

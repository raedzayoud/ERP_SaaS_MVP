import { Injectable, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { Product, ProductInput, ProductQuery } from '../models/product';

const LATENCY_MS = 300;

const NORD = 'f4a1c2e0-8a01-4a10-9d21-000000000003';
const VERDE = 'f4a1c2e0-8a01-4a10-9d21-000000000007';

const SEED_PRODUCTS: Product[] = [
  {
    id: 'a1000000-0000-4000-8000-000000000001',
    sku: 'SKU-1001',
    name: 'Laptop Pro 14',
    description: '14" business laptop, 16 GB RAM, 512 GB SSD.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 1299,
    purchasePrice: 900,
    vatRate: 19,
    minStock: 6,
    suppliers: [
      {
        id: 'ps-1001',
        supplierId: VERDE,
        supplierRef: 'VRD-LP14',
        price: 900,
        minQty: 1,
        delayDays: 14,
      },
    ],
    active: true,
    createdAt: '2026-01-08T10:00:00.000Z',
    updatedAt: '2026-01-08T10:00:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    sku: 'SKU-1002',
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with USB receiver.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 24.9,
    purchasePrice: 15,
    vatRate: 19,
    minStock: 70,
    suppliers: [
      {
        id: 'ps-1002',
        supplierId: NORD,
        supplierRef: 'NRD-MSE-14',
        price: 15,
        minQty: 10,
        delayDays: 7,
      },
      {
        id: 'ps-1003',
        supplierId: VERDE,
        supplierRef: 'VRD-MSE',
        price: 16.5,
        minQty: 5,
        delayDays: 21,
      },
    ],
    active: true,
    createdAt: '2026-01-15T09:30:00.000Z',
    updatedAt: '2026-01-15T09:30:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000003',
    sku: 'SKU-1003',
    name: 'USB-C Docking Station',
    description: 'Dual display docking station, 100 W power delivery.',
    type: 'good',
    unit: 'piece',
    category: 'hardware',
    salePrice: 189,
    purchasePrice: 120,
    vatRate: 19,
    suppliers: [
      {
        id: 'ps-1004',
        supplierId: VERDE,
        supplierRef: 'VRD-DOCK-C',
        price: 120,
        minQty: 1,
        delayDays: 14,
      },
    ],
    active: true,
    createdAt: '2026-02-02T14:20:00.000Z',
    updatedAt: '2026-02-02T14:20:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000004',
    sku: 'SKU-1004',
    name: 'Refurbished Desktop',
    description: 'Desktop workstation, refurbished, 12 month warranty.',
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
    description: 'On-site installation and configuration of equipment.',
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
    description: 'Remote support subscription, business hours.',
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
      {
        id: 'ps-1005',
        supplierId: NORD,
        supplierRef: 'NRD-PAP-A4',
        price: 8,
        minQty: 20,
        delayDays: 7,
      },
    ],
    active: true,
    createdAt: '2026-03-21T10:40:00.000Z',
    updatedAt: '2026-03-21T10:40:00.000Z',
  },
  {
    id: 'a1000000-0000-4000-8000-000000000009',
    sku: 'SKU-3002',
    name: 'Toner Cartridge',
    description: 'Black toner cartridge, 2500 page yield.',
    type: 'good',
    unit: 'piece',
    category: 'consumables',
    salePrice: 78,
    purchasePrice: 60,
    vatRate: 19,
    minStock: 15,
    suppliers: [
      {
        id: 'ps-1006',
        supplierId: NORD,
        supplierRef: 'NRD-TNR-BK',
        price: 60,
        minQty: 5,
        delayDays: 7,
      },
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

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly items = signal<Product[]>(SEED_PRODUCTS);

  getProducts(query: ProductQuery): Observable<Page<Product>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getProduct(id: string): Observable<Product | undefined> {
    return timer(LATENCY_MS).pipe(map(() => this.items().find((p) => p.id === id)));
  }

  createProduct(data: ProductInput): Observable<Product> {
    const now = new Date().toISOString();
    const product: Product = {
      id: this.newId(),
      active: true,
      createdAt: now,
      updatedAt: now,
      ...data,
      suppliers: data.suppliers.map((entry) => ({ id: this.newId(), ...entry })),
    };

    return timer(LATENCY_MS).pipe(
      map(() => {
        this.items.update((list) => [...list, product]);
        return product;
      }),
    );
  }

  updateProduct(id: string, data: ProductInput): Observable<Product> {
    return this.mutate(id, (existing) => ({
      ...existing,
      ...data,
      suppliers: data.suppliers.map((entry) => ({ id: this.newId(), ...entry })),
      updatedAt: new Date().toISOString(),
    }));
  }

  archiveProduct(id: string): Observable<Product> {
    return this.mutate(id, (existing) => ({
      ...existing,
      active: false,
      updatedAt: new Date().toISOString(),
    }));
  }

  restoreProduct(id: string): Observable<Product> {
    return this.mutate(id, (existing) => ({
      ...existing,
      active: true,
      updatedAt: new Date().toISOString(),
    }));
  }

  private buildPage(query: ProductQuery): Page<Product> {
    const search = query.search?.trim().toLowerCase();
    const size = query.size > 0 ? query.size : 10;

    const filtered = this.items().filter((product) => {
      if (query.type && product.type !== query.type) return false;
      if (query.category && product.category !== query.category) return false;
      if (query.active !== undefined && product.active !== query.active) return false;
      if (search && !this.matchesSearch(product, search)) return false;
      return true;
    });

    const sorted = this.sortProducts(filtered, query.sort);

    return {
      items: sorted.slice(query.page * size, query.page * size + size),
      total: sorted.length,
      page: query.page,
      size,
    };
  }

  private matchesSearch(product: Product, search: string): boolean {
    const haystack = [product.sku, product.name, product.description];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private sortProducts(list: Product[], sort: string | undefined): Product[] {
    const [field, direction] = (sort ?? 'name,asc').split(',');
    const sign = direction === 'desc' ? -1 : 1;

    return [...list].sort((a, b) => {
      if (field === 'salePrice') return (a.salePrice - b.salePrice) * sign;
      if (field === 'createdAt') return a.createdAt.localeCompare(b.createdAt) * sign;
      return a.name.localeCompare(b.name) * sign;
    });
  }

  private mutate(id: string, apply: (product: Product) => Product): Observable<Product> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const existing = this.items().find((p) => p.id === id);
        if (!existing) {
          throw new Error(`Product not found: ${id}`);
        }
        const updated = apply(existing);
        this.items.update((list) => list.map((p) => (p.id === id ? updated : p)));
        return updated;
      }),
    );
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

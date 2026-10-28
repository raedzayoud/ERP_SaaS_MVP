import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { ProductService } from '../../services/product.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { Product, ProductQuery, ProductType } from '../../models/product';

type ActiveFilter = 'active' | 'archived' | 'all';
type SortField = 'name' | 'salePrice' | 'createdAt';

@Component({
  selector: 'app-products',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products {

  private readonly service = inject(ProductService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly permissions = inject(PermissionService);
  readonly pageSize = 10;

  contactFilterId = signal(this.route.snapshot.queryParamMap.get('supplier'));
  contactFilterName = signal(this.route.snapshot.queryParamMap.get('supplierName'));

  products = signal<Product[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  typeFilter = signal<ProductType | ''>('');
  categoryFilter = signal('');
  activeFilter = signal<ActiveFilter>('active');
  sort = signal('name,asc');

  currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () =>
      this.search() !== '' ||
      this.typeFilter() !== '' ||
      this.categoryFilter() !== '' ||
      this.activeFilter() !== 'active' ||
      this.contactFilterId() !== null,
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.page.set(0);
        this.load();
      });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const query: ProductQuery = {
      page: this.page(),
      size: this.pageSize,
      search: this.search() || undefined,
      type: this.typeFilter() || undefined,
      category: this.categoryFilter() || undefined,
      active: this.activeFilter() === 'all' ? undefined : this.activeFilter() === 'active',
      sort: this.sort(),
    };

    this.service
      .getProducts(this.contactFilterId() ? { ...query, page: 0, size: 500 } : query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (this.contactFilterId()) {
            const filtered = result.items.filter((product) =>
              product.suppliers.some((entry) => entry.supplierId === this.contactFilterId()),
            );
            const start = this.page() * this.pageSize;
            this.products.set(filtered.slice(start, start + this.pageSize));
            this.total.set(filtered.length);
          } else {
            this.products.set(result.items);
            this.total.set(result.total);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  clearContactFilter(): void {
    this.contactFilterId.set(null);
    this.contactFilterName.set(null);
    this.page.set(0);
    this.load();
  }

  setPage(nextPage: number): void {
    if (nextPage < 0 || nextPage >= this.totalPages() || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.load();
  }

  setSort(field: SortField): void {
    const [currentField, currentDirection] = this.sort().split(',');
    const direction = currentField === field && currentDirection === 'asc' ? 'desc' : 'asc';
    this.sort.set(`${field},${direction}`);
    this.page.set(0);
    this.load();
  }

  sortIcon(field: SortField): string {
    const [currentField, currentDirection] = this.sort().split(',');
    if (currentField !== field) return '';
    return currentDirection === 'desc' ? '↓' : '↑';
  }

  ariaSort(field: SortField): 'ascending' | 'descending' | 'none' {
    const [currentField, currentDirection] = this.sort().split(',');
    if (currentField !== field) return 'none';
    return currentDirection === 'desc' ? 'descending' : 'ascending';
  }

  onTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as ProductType | '');
    this.page.set(0);
    this.load();
  }

  onCategoryFilter(event: Event): void {
    this.categoryFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.load();
  }

  onActiveFilter(event: Event): void {
    this.activeFilter.set((event.target as HTMLSelectElement).value as ActiveFilter);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.typeFilter.set('');
    this.categoryFilter.set('');
    this.activeFilter.set('active');
    this.page.set(0);
    this.load();
  }

  archive(product: Product): void {
    this.service
      .archiveProduct(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showNotice('products.archived');
        this.load();
      });
  }

  restore(product: Product): void {
    this.service
      .restoreProduct(product.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.showNotice('products.restored');
        this.load();
      });
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}

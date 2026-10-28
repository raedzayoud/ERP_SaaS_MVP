import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import {
  PurchaseOrder,
  PurchaseQuery,
  PurchaseStatus,
  PurchaseSummary,
  ReceptionState,
} from '../../models/purchase-order';
import { PurchaseService } from '../../services/purchase.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { isLate, purchaseTotals, receptionState } from '../../utils/purchase-calc';
import { ReceptionBadge } from '../../components/reception-badge/reception-badge';

type SortField = 'orderDate' | 'expectedDate';

@Component({
  selector: 'app-purchases',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    StatusBadge,
    ReceptionBadge,
  ],
  templateUrl: './purchases.html',
  styleUrl: './purchases.css',
})
export class Purchases {
  private readonly service = inject(PurchaseService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  readonly permissions = inject(PermissionService);

  readonly pageSize = 10;
  readonly statuses: PurchaseStatus[] = ['draft', 'confirmed', 'cancelled'];

  contactFilterId = signal(this.route.snapshot.queryParamMap.get('supplier'));
  contactFilterName = signal(this.route.snapshot.queryParamMap.get('supplierName'));

  orders = signal<PurchaseOrder[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);
  summary = signal<PurchaseSummary>({ awaiting: 0, late: 0 });

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  statusFilter = signal<PurchaseStatus | ''>('');
  sort = signal('orderDate,desc');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () =>
      this.search() !== '' || this.statusFilter() !== '' || this.contactFilterId() !== null,
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
    this.loadSummary();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const query: PurchaseQuery = {
      page: this.page(),
      size: this.pageSize,
      search: this.search() || undefined,
      status: this.statusFilter() || undefined,
      sort: this.sort(),
    };

    this.service
      .getOrders(this.contactFilterId() ? { ...query, page: 0, size: 500 } : query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (this.contactFilterId()) {
            const filtered = result.items.filter(
              (order) => order.supplierId === this.contactFilterId(),
            );
            const start = this.page() * this.pageSize;
            this.orders.set(filtered.slice(start, start + this.pageSize));
            this.total.set(filtered.length);
          } else {
            this.orders.set(result.items);
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

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as PurchaseStatus | '');
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusFilter.set('');
    this.page.set(0);
    this.load();
  }

  totalOf(order: PurchaseOrder): number {
    return purchaseTotals(order.lines, order.currency).totalTtc;
  }

  receptionOf(order: PurchaseOrder): ReceptionState {
    return receptionState(order.lines);
  }

  lateOf(order: PurchaseOrder): boolean {
    return isLate(order);
  }

  private loadSummary(): void {
    this.service
      .getSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => this.summary.set(summary));
  }
}

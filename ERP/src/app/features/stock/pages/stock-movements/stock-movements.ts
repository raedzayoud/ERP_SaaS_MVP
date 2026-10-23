import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MovementType, StockMovementRow } from '../../models/stock-movement';
import { Warehouse } from '../../models/warehouse';
import { StockService } from '../../services/stock.service';

@Component({
  selector: 'app-stock-movements',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './stock-movements.html',
  styleUrl: './stock-movements.css',
})
export class StockMovements {
  private readonly service = inject(StockService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 10;
  readonly types: MovementType[] = ['purchase', 'sale', 'adjustment', 'transfer'];

  rows = signal<StockMovementRow[]>([]);
  warehouses = signal<Warehouse[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  typeFilter = signal<MovementType | ''>('');
  warehouseFilter = signal('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () => this.search() !== '' || this.typeFilter() !== '' || this.warehouseFilter() !== '',
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.page.set(0);
        this.load();
      });

    this.loadWarehouses();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service
      .getMovements({
        page: this.page(),
        size: this.pageSize,
        search: this.search() || undefined,
        type: this.typeFilter() || undefined,
        warehouseId: this.warehouseFilter() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.rows.set(result.items);
          this.total.set(result.total);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  setPage(nextPage: number): void {
    if (nextPage < 0 || nextPage >= this.totalPages() || nextPage === this.page()) {
      return;
    }
    this.page.set(nextPage);
    this.load();
  }

  onTypeFilter(event: Event): void {
    this.typeFilter.set((event.target as HTMLSelectElement).value as MovementType | '');
    this.page.set(0);
    this.load();
  }

  onWarehouseFilter(event: Event): void {
    this.warehouseFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.typeFilter.set('');
    this.warehouseFilter.set('');
    this.page.set(0);
    this.load();
  }

  signedQty(row: StockMovementRow): number {
    return row.direction === 'in' ? row.quantity : -row.quantity;
  }

  movementBadge(type: MovementType): string {
    switch (type) {
      case 'purchase':
        return 'success';
      case 'sale':
        return 'info';
      case 'adjustment':
        return 'warning';
      case 'transfer':
        return 'primary';
    }
  }

  private loadWarehouses(): void {
    this.service
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((warehouses) => this.warehouses.set(warehouses));
  }
}

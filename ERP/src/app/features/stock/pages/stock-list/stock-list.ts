import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { StockLevelRow } from '../../models/stock-movement';
import { Warehouse } from '../../models/warehouse';
import { StockService } from '../../services/stock.service';

@Component({
  selector: 'app-stock-list',
  imports: [CurrencyPipe, DecimalPipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './stock-list.html',
  styleUrl: './stock-list.css',
})
export class StockList {
  private readonly service = inject(StockService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  rows = signal<StockLevelRow[]>([]);
  warehouses = signal<Warehouse[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  warehouseFilter = signal('');

  totalValue = computed(() => this.rows().reduce((sum, row) => sum + row.value, 0));
  lowCount = computed(() => this.rows().filter((row) => row.low).length);

  /** The currency of the current workspace, used for all money displays. */
  readonly currency = computed(() => this.tenantService.activeCurrency());

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.load();
      });

    this.loadWarehouses();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service
      .getLevels({ warehouseId: this.warehouseFilter() || undefined, search: this.search() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onWarehouseFilter(event: Event): void {
    this.warehouseFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  private loadWarehouses(): void {
    this.service
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((warehouses) => this.warehouses.set(warehouses.filter((w) => w.active)));
  }
}

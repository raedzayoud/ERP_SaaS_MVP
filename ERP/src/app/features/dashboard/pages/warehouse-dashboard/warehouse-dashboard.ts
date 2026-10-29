import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import {
  MovementType,
  StockLevelRow,
  StockMovementRow,
} from '../../../stock/models/stock-movement';
import { StockService } from '../../../stock/services/stock.service';

@Component({
  selector: 'app-warehouse-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './warehouse-dashboard.html',
  styleUrl: './warehouse-dashboard.css',
})
export class WarehouseDashboard {
  private readonly stockService = inject(StockService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  stockValue = signal(0);
  stockItems = signal(0);
  warehouses = signal(0);
  lowStockLevels = signal<StockLevelRow[]>([]);
  lowStockCount = computed(() => this.lowStockLevels().length);
  recentMovements = signal<StockMovementRow[]>([]);

  loading = signal(true);
  loadFailed = signal(false);

  readonly quickActions = [
    { labelKey: 'stock.levels.newAdjustment', icon: '⚖️', route: '/stock/adjustment' },
    { labelKey: 'stock.levels.newTransfer', icon: '🔀', route: '/stock/transfer' },
    { labelKey: 'stock.movements.title', icon: '📜', route: '/stock/movements' },
    { labelKey: 'stock.warehouses.title', icon: '🏭', route: '/stock/warehouses' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      levels: this.stockService.getLevels({}),
      movements: this.stockService.getMovements({ page: 0, size: 5, sort: 'date,desc' }),
      warehouses: this.stockService.getWarehouses(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.stockValue.set(data.levels.reduce((sum, row) => sum + row.value, 0));
          this.stockItems.set(data.levels.length);
          this.lowStockLevels.set(data.levels.filter((row) => row.low).slice(0, 5));
          this.warehouses.set(data.warehouses.length);
          this.recentMovements.set(data.movements.items);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  movementIcon(type: MovementType): string {
    const icons: Record<MovementType, string> = {
      purchase: '🚚',
      sale: '🧾',
      adjustment: '⚖️',
      transfer: '🔀',
    };
    return icons[type];
  }
}

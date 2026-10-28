import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  BillState,
  SupplierBill,
  SupplierBillQuery,
} from '../../models/supplier-bill';
import { SupplierBillService } from '../../services/supplier-bill.service';
import { PermissionService } from '../../../../core/services/permission.service';

@Component({
  selector: 'app-supplier-bills',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './supplier-bills.html',
  styleUrl: './supplier-bills.css',
})
export class SupplierBills {
  readonly service = inject(SupplierBillService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  readonly pageSize = 10;
  readonly states: BillState[] = ['unpaid', 'partial', 'paid'];

  bills = signal<SupplierBill[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  stateFilter = signal<BillState | ''>('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(() => this.search() !== '' || this.stateFilter() !== '');

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

    const query: SupplierBillQuery = {
      page: this.page(),
      size: this.pageSize,
      search: this.search() || undefined,
      state: this.stateFilter() || undefined,
    };

    this.service
      .getBills(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.bills.set(result.items);
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

  onStateFilter(event: Event): void {
    this.stateFilter.set((event.target as HTMLSelectElement).value as BillState | '');
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.stateFilter.set('');
    this.page.set(0);
    this.load();
  }

  numberOf(bill: SupplierBill): string {
    return bill.number;
  }

  stateClass(bill: SupplierBill): string {
    const state = this.service.stateOf(bill);
    return state === 'paid' ? 'badge-success' : state === 'partial' ? 'badge-info' : 'badge-warning';
  }

  sourceOf(bill: SupplierBill): string {
    return bill.sourceType === 'order' ? (bill.orderNumber ?? '') : '';
  }

  remove(bill: SupplierBill): void {
    this.service
      .deleteBill(bill.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: () => this.load(),
      });
  }
}

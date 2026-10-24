import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { CurrencyPipe } from '@angular/common';
import { PAYMENT_MODES, Payment, PaymentMode } from '../../models/payment';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payments',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './payments.html',
  styleUrl: './payments.css',
})
export class Payments {
  private readonly service = inject(PaymentService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 10;
  readonly modes = PAYMENT_MODES;

  rows = signal<Payment[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  modeFilter = signal<PaymentMode | ''>('');
  fromFilter = signal('');
  toFilter = signal('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () =>
      this.search() !== '' ||
      this.modeFilter() !== '' ||
      this.fromFilter() !== '' ||
      this.toFilter() !== '',
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

    this.service
      .getPayments({
        page: this.page(),
        size: this.pageSize,
        search: this.search() || undefined,
        mode: this.modeFilter() || undefined,
        from: this.fromFilter() || undefined,
        to: this.toFilter() || undefined,
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

  onModeFilter(event: Event): void {
    this.modeFilter.set((event.target as HTMLSelectElement).value as PaymentMode | '');
    this.page.set(0);
    this.load();
  }

  onFromFilter(event: Event): void {
    this.fromFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.load();
  }

  onToFilter(event: Event): void {
    this.toFilter.set((event.target as HTMLSelectElement).value);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.modeFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.page.set(0);
    this.load();
  }
}

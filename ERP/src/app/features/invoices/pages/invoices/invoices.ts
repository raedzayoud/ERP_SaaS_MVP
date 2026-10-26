import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import {
  Invoice,
  InvoiceKind,
  InvoiceQuery,
  InvoiceStatus,
  InvoiceSummary,
  PaymentState,
} from '../../models/invoice';
import { InvoiceService } from '../../services/invoice.service';
import { dueFor, invoiceTotals, isOverdue, paymentState } from '../../utils/invoice-calc';

type SortField = 'issueDate' | 'dueDate' | 'total';
type PaidFilter = 'unpaid' | 'partial' | 'paid';

@Component({
  selector: 'app-invoices',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    StatusBadge,
  ],
  templateUrl: './invoices.html',
  styleUrl: './invoices.css',
})
export class Invoices {
  private readonly service = inject(InvoiceService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  readonly pageSize = 10;
  readonly fixedKind = this.route.snapshot.data['kind'] as InvoiceKind | undefined;

  contactFilterId = signal(this.route.snapshot.queryParamMap.get('customer'));
  contactFilterName = signal(this.route.snapshot.queryParamMap.get('customerName'));

  invoices = signal<Invoice[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);
  summary = signal<InvoiceSummary>({ outstanding: 0, overdue: 0 });

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  kindFilter = signal<InvoiceKind | ''>(this.fixedKind ?? '');
  statusFilter = signal<InvoiceStatus | ''>('');
  paidFilter = signal<PaidFilter | ''>('');
  fromFilter = signal('');
  toFilter = signal('');
  sort = signal('issueDate,desc');

  currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () =>
      this.search() !== '' ||
      (this.fixedKind === undefined && this.kindFilter() !== '') ||
      this.statusFilter() !== '' ||
      this.paidFilter() !== '' ||
      this.fromFilter() !== '' ||
      this.toFilter() !== '' ||
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
    this.loadSummary();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const query: InvoiceQuery = {
      page: this.page(),
      size: this.pageSize,
      search: this.search() || undefined,
      kinds: this.kindFilter() ? [this.kindFilter() as InvoiceKind] : undefined,
      status: this.statusFilter() || undefined,
      paid: this.paidFilter() || undefined,
      from: this.fromFilter() || undefined,
      to: this.toFilter() || undefined,
      sort: this.sort(),
    };

    this.service
      .getInvoices(this.contactFilterId() ? { ...query, page: 0, size: 500 } : query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (this.contactFilterId()) {
            const filtered = result.items.filter(
              (invoice) => invoice.customerId === this.contactFilterId(),
            );
            const start = this.page() * this.pageSize;
            this.invoices.set(filtered.slice(start, start + this.pageSize));
            this.total.set(filtered.length);
          } else {
            this.invoices.set(result.items);
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

  onKindFilter(event: Event): void {
    this.kindFilter.set((event.target as HTMLSelectElement).value as InvoiceKind | '');
    this.page.set(0);
    this.load();
  }

  onStatusFilter(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as InvoiceStatus | '');
    this.page.set(0);
    this.load();
  }

  onPaidFilter(event: Event): void {
    this.paidFilter.set((event.target as HTMLSelectElement).value as PaidFilter | '');
    this.page.set(0);
    this.load();
  }

  onFromFilter(event: Event): void {
    this.fromFilter.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    this.load();
  }

  onToFilter(event: Event): void {
    this.toFilter.set((event.target as HTMLInputElement).value);
    this.page.set(0);
    this.load();
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.kindFilter.set(this.fixedKind ?? '');
    this.statusFilter.set('');
    this.paidFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.page.set(0);
    this.load();
  }

  totalOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalTtc;
  }

  dueOf(invoice: Invoice): number {
    return dueFor(invoice);
  }

  paymentOf(invoice: Invoice): PaymentState {
    return paymentState(invoice);
  }

  overdueOf(invoice: Invoice): boolean {
    return isOverdue(invoice);
  }

  private loadSummary(): void {
    this.service
      .getSummary(this.currency())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => this.summary.set(summary));
  }
}

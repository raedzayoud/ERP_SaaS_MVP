import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { JournalCode, JournalEntry, JOURNAL_CODES } from '../../models/journal';
import { AccountingService } from '../../services/accounting.service';

@Component({
  selector: 'app-journal-entries',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './journal-entries.html',
  styleUrl: './journal-entries.css',
})
export class JournalEntries {
  private readonly service = inject(AccountingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = 10;
  readonly journals = JOURNAL_CODES;

  rows = signal<JournalEntry[]>([]);
  total = signal(0);
  page = signal(0);
  loading = signal(true);
  loadFailed = signal(false);

  searchControl = new FormControl('', { nonNullable: true });
  search = signal('');
  journalFilter = signal<JournalCode | ''>('');
  fromFilter = signal('');
  toFilter = signal('');

  totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  pageStart = computed(() => (this.total() === 0 ? 0 : this.page() * this.pageSize + 1));
  pageEnd = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize));
  hasFilters = computed(
    () =>
      this.search() !== '' ||
      this.journalFilter() !== '' ||
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
      .getJournalEntries({
        page: this.page(),
        size: this.pageSize,
        search: this.search() || undefined,
        journal: this.journalFilter() || undefined,
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

  onJournalFilter(event: Event): void {
    this.journalFilter.set((event.target as HTMLSelectElement).value as JournalCode | '');
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
    this.journalFilter.set('');
    this.fromFilter.set('');
    this.toFilter.set('');
    this.page.set(0);
    this.load();
  }

  entryTotal(entry: JournalEntry): number {
    return entry.lines.reduce((sum, line) => sum + line.debit, 0);
  }

  journalBadge(journal: JournalCode): string {
    switch (journal) {
      case 'SALES':
        return 'badge-primary';
      case 'PURCHASES':
        return 'badge-info';
      case 'PAYMENTS':
        return 'badge-success';
      case 'STOCK':
        return 'badge-warning';
    }
  }
}

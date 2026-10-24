import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { JournalEntry } from '../../models/journal';
import { AccountingService } from '../../services/accounting.service';

@Component({
  selector: 'app-journal-entry-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './journal-entry-detail.html',
  styleUrl: './journal-entry-detail.css',
})
export class JournalEntryDetail {
  private readonly service = inject(AccountingService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly entryId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly entry = signal<JournalEntry | null>(null);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  readonly totalDebit = computed(() => {
    const entry = this.entry();
    return entry ? entry.lines.reduce((sum, line) => sum + line.debit, 0) : 0;
  });

  readonly totalCredit = computed(() => {
    const entry = this.entry();
    return entry ? entry.lines.reduce((sum, line) => sum + line.credit, 0) : 0;
  });

  readonly balanced = computed(() => this.totalDebit() === this.totalCredit());

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.entryId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.service
      .getJournalEntry(this.entryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entry) => {
          if (entry) {
            this.entry.set(entry);
          } else {
            this.loadFailed.set(true);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  sourceRoute(entry: JournalEntry): string[] | null {
    if (entry.id.startsWith('inv:')) return ['/invoices', entry.id.slice(4)];
    if (entry.id.startsWith('po:')) return ['/purchases', entry.id.slice(3)];
    if (entry.id.startsWith('pay:')) return ['/payments', entry.id.slice(4)];
    if (entry.id.startsWith('adj:')) return ['/stock/movements'];
    return null;
  }

  sourceLabelKey(entry: JournalEntry): string {
    if (entry.id.startsWith('inv:')) return 'accounting.detail.viewInvoice';
    if (entry.id.startsWith('po:')) return 'accounting.detail.viewOrder';
    if (entry.id.startsWith('pay:')) return 'accounting.detail.viewPayment';
    return 'accounting.detail.viewMovements';
  }
}

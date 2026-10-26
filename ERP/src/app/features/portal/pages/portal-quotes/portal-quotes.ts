import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { todayIso } from '../../../../shared/utils/money';
import { Invoice } from '../../../invoices/models/invoice';
import { invoiceTotals } from '../../../invoices/utils/invoice-calc';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-portal-quotes',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './portal-quotes.html',
  styleUrl: './portal-quotes.css',
})
export class PortalQuotes {
  private readonly portal = inject(PortalService);

  quotes = signal<Invoice[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.portal.getMyQuotes().subscribe({
      next: (page) => {
        this.quotes.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  totalOf(quote: Invoice): number {
    return invoiceTotals(quote).totalTtc;
  }

  expiredOf(quote: Invoice): boolean {
    return quote.dueDate < todayIso();
  }
}

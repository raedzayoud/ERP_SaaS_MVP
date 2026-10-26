import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Invoice } from '../../../invoices/models/invoice';
import { invoiceTotals, isOverdue, paymentState } from '../../../invoices/utils/invoice-calc';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-portal-invoices',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './portal-invoices.html',
  styleUrl: './portal-invoices.css',
})
export class PortalInvoices {
  private readonly portal = inject(PortalService);

  invoices = signal<Invoice[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.portal.getMyInvoices().subscribe({
      next: (page) => {
        this.invoices.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  totalOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalTtc;
  }

  dueOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalToPay;
  }

  stateOf(invoice: Invoice): ReturnType<typeof paymentState> {
    return paymentState(invoice);
  }

  overdueOf(invoice: Invoice): boolean {
    return isOverdue(invoice);
  }

  stateClass(invoice: Invoice): string {
    const state = paymentState(invoice);
    if (state === 'paid') return 'state-paid';
    if (state === 'partial') return 'state-partial';
    return 'state-unpaid';
  }
}

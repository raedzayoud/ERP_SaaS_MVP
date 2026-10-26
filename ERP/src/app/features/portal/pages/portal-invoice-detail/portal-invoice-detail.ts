import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { Invoice } from '../../../invoices/models/invoice';
import { dueFor, invoiceTotals, paymentState } from '../../../invoices/utils/invoice-calc';

@Component({
  selector: 'app-portal-invoice-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './portal-invoice-detail.html',
  styleUrl: './portal-invoice-detail.css',
})
export class PortalInvoiceDetail {
  private readonly invoiceService = inject(InvoiceService);
  private readonly route = inject(ActivatedRoute);

  invoice = signal<Invoice | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  paying = signal(false);
  paySuccess = signal(false);
  payFailed = signal(false);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.load(id);
    } else {
      this.loadFailed.set(true);
      this.loading.set(false);
    }
  }

  load(id: string): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.invoiceService.getInvoice(id).subscribe({
      next: (invoice) => {
        if (invoice && invoice.kind === 'invoice') {
          this.invoice.set(invoice);
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

  /** Mock Stripe checkout: records the remaining amount as paid. */
  payNow(): void {
    const invoice = this.invoice();
    if (!invoice) return;

    const remaining = dueFor(invoice);
    if (remaining <= 0) return;

    this.paying.set(true);
    this.paySuccess.set(false);
    this.payFailed.set(false);

    this.invoiceService.addPayment(invoice.id, remaining).subscribe({
      next: (updated) => {
        this.invoice.set(updated);
        this.paying.set(false);
        this.paySuccess.set(true);
      },
      error: () => {
        this.paying.set(false);
        this.payFailed.set(true);
      },
    });
  }

  totalOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalTtc;
  }

  netOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalNet;
  }

  vatOf(invoice: Invoice): number {
    return invoiceTotals(invoice).totalVat;
  }

  dueOf(invoice: Invoice): number {
    return dueFor(invoice);
  }

  paidOf(invoice: Invoice): number {
    return invoiceTotals(invoice).amountPaid;
  }

  stateOf(invoice: Invoice): ReturnType<typeof paymentState> {
    return paymentState(invoice);
  }
}

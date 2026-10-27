import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { MockMail, MockMailService } from '../../../../core/services/mock-mail.service';
import { Invoice } from '../../../invoices/models/invoice';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { invoiceTotals } from '../../../invoices/utils/invoice-calc';
import { SalesOrder } from '../../../sales/models/sales-order';
import { SalesError, SalesOrderService } from '../../../sales/services/sales-order.service';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-portal-quote-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './portal-quote-detail.html',
  styleUrl: './portal-quote-detail.css',
})
export class PortalQuoteDetail {
  private readonly portal = inject(PortalService);
  private readonly invoices = inject(InvoiceService);
  private readonly orders = inject(SalesOrderService);
  private readonly mail = inject(MockMailService);
  private readonly route = inject(ActivatedRoute);

  readonly quoteId = this.route.snapshot.paramMap.get('id') ?? '';

  quote = signal<Invoice | null>(null);
  existingOrder = signal<SalesOrder | null>(null);
  mailPreview = signal<MockMail | null>(null);
  notice = signal('');
  errorKey = signal<string | null>(null);

  loading = signal(true);
  loadFailed = signal(false);
  saving = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.quoteId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    forkJoin({
      quote: this.invoices.getInvoice(this.quoteId),
      order: this.orders.getOrderByQuote(this.quoteId),
    }).subscribe({
      next: ({ quote, order }) => {
        const isMine =
          !!quote &&
          quote.kind === 'quote' &&
          quote.customerId === this.portal.customerId;

        if (!isMine) {
          this.loadFailed.set(true);
        } else {
          this.quote.set(quote);
          this.existingOrder.set(order ?? null);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  /** Accepts the quote: creates the confirmed sales order and shows the confirmation e-mail. */
  accept(): void {
    const quote = this.quote();
    if (!quote || this.existingOrder()) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.portal.acceptQuote(quote.id, quote.number ?? '').subscribe({
      next: (order) => {
        this.saving.set(false);
        this.existingOrder.set(order);
        this.mailPreview.set(this.mail.last());
        this.notice.set('portal.quotes.accepted');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorKey.set(
          error instanceof SalesError
            ? `sales.errors.${error.code}`
            : 'portal.quotes.acceptError',
        );
      },
    });
  }

  totalOf(quote: Invoice): number {
    return invoiceTotals(quote).totalTtc;
  }

  netOf(quote: Invoice): number {
    return invoiceTotals(quote).totalNet;
  }

  vatOf(quote: Invoice): number {
    return invoiceTotals(quote).totalVat;
  }
}

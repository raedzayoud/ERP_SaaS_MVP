import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth.service';
import { MockMailService } from '../../../core/services/mock-mail.service';
import { Page } from '../../../shared/models/page';
import { Invoice } from '../../invoices/models/invoice';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { SalesOrder } from '../../sales/models/sales-order';
import { SalesOrderService } from '../../sales/services/sales-order.service';

/**
 * The demo external client (client@demo.com) belongs to this company.
 * Every portal screen is filtered with it, so a client only ever sees
 * its own documents.
 */
export const PORTAL_CUSTOMER_ID = 'f4a1c2e0-8a01-4a10-9d21-000000000002';

@Injectable({ providedIn: 'root' })
export class PortalService {
  private readonly invoices = inject(InvoiceService);
  private readonly orders = inject(SalesOrderService);
  private readonly mail = inject(MockMailService);
  private readonly auth = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  readonly customerId = PORTAL_CUSTOMER_ID;

  getMyInvoices(): Observable<Page<Invoice>> {
    return this.invoices.getInvoices({
      page: 0,
      size: 200,
      status: 'posted',
      kinds: ['invoice'],
      customerId: this.customerId,
    });
  }

  getMyQuotes(): Observable<Page<Invoice>> {
    return this.invoices.getInvoices({
      page: 0,
      size: 200,
      status: 'posted',
      kinds: ['quote'],
      customerId: this.customerId,
    });
  }

  getMyOrders(): Observable<Page<SalesOrder>> {
    return this.orders
      .getOrders({ page: 0, size: 200, customerId: this.customerId })
      .pipe(
        map((page) => ({
          ...page,
          // Drafts are hidden, except those created by an accepted quote:
          // the client must see the order being prepared.
          items: page.items.filter(
            (order) => order.status !== 'draft' || order.originQuoteId !== null,
          ),
        })),
      );
  }

  /** Accepts a quote: creates the confirmed sales order and "sends" the confirmation e-mail. */
  acceptQuote(quoteId: string, quoteNumber: string): Observable<SalesOrder> {
    return this.orders.convertQuoteToOrder(quoteId).pipe(
      map((order) => {
        const orderNumber = order.number ?? '';
        this.mail.send({
          to: this.auth.currentUser()?.email ?? '',
          subject: this.transloco.translate('portal.quotes.email.subject', {
            quote: quoteNumber,
            order: orderNumber,
          }),
          body: this.transloco.translate('portal.quotes.email.body', {
            quote: quoteNumber,
            order: orderNumber,
          }),
        });
        return order;
      }),
    );
  }
}

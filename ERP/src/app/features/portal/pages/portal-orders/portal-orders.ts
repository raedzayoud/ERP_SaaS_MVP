import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { SalesOrder } from '../../../sales/models/sales-order';
import { salesTotals } from '../../../sales/utils/sales-calc';
import { PortalService } from '../../services/portal.service';

@Component({
  selector: 'app-portal-orders',
  imports: [CurrencyPipe, DatePipe, TranslocoDirective],
  templateUrl: './portal-orders.html',
  styleUrl: './portal-orders.css',
})
export class PortalOrders {
  private readonly portal = inject(PortalService);

  orders = signal<SalesOrder[]>([]);
  loading = signal(true);
  loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.portal.getMyOrders().subscribe({
      next: (page) => {
        this.orders.set(page.items);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }

  totalOf(order: SalesOrder): number {
    return salesTotals(order.lines, order.currency).totalTtc;
  }

  statusOf(order: SalesOrder): string {
    return order.invoiceId !== null ? 'invoiced' : order.status;
  }

  stateClass(order: SalesOrder): string {
    if (order.status === 'cancelled') return 'state-cancelled';
    if (order.invoiceId !== null) return 'state-paid';
    return 'state-unpaid';
  }
}

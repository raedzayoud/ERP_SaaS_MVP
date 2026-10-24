import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { todayIso } from '../../../../shared/utils/money';
import { Invoice } from '../../../invoices/models/invoice';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { invoiceTotals, signedTotal } from '../../../invoices/utils/invoice-calc';
import { PartnerService } from '../../../crm/services/partner.service';
import { ProductService } from '../../../products/services/product.service';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { PaymentService } from '../../../payments/services/payment.service';
import { StockService } from '../../../stock/services/stock.service';

@Component({
  selector: 'app-dashboard-home',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.css',
})
export class DashboardHome {
  private readonly invoicesService = inject(InvoiceService);
  private readonly paymentsService = inject(PaymentService);
  private readonly stockService = inject(StockService);
  private readonly purchasesService = inject(PurchaseService);
  private readonly partnersService = inject(PartnerService);
  private readonly productsService = inject(ProductService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  revenue = signal(0);
  outstanding = signal(0);
  overdue = signal(0);
  paymentsMonth = signal(0);
  stockValue = signal(0);
  stockItems = signal(0);
  customers = signal(0);
  products = signal(0);
  pendingOrders = signal(0);
  lateOrders = signal(0);
  recentInvoices = signal<Invoice[]>([]);

  loading = signal(true);
  loadFailed = signal(false);

  readonly quickActions = [
    { labelKey: 'dashboard.quick.newInvoice', icon: '🧾', route: '/invoices/new' },
    { labelKey: 'dashboard.quick.newContact', icon: '👥', route: '/contacts/new' },
    { labelKey: 'dashboard.quick.newProduct', icon: '📦', route: '/products/new' },
    { labelKey: 'dashboard.quick.newOrder', icon: '🛒', route: '/purchases/new' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const today = todayIso();
    const monthStart = `${today.slice(0, 7)}-01`;

    forkJoin({
      monthInvoices: this.invoicesService.getInvoices({
        page: 0,
        size: 500,
        status: 'posted',
        kinds: ['invoice', 'credit_note'],
        from: monthStart,
        to: today,
      }),
      invoiceSummary: this.invoicesService.getSummary(this.currency()),
      monthPayments: this.paymentsService.getPayments({
        page: 0,
        size: 500,
        from: monthStart,
        to: today,
      }),
      levels: this.stockService.getLevels({}),
      purchaseSummary: this.purchasesService.getSummary(),
      partners: this.partnersService.getPartners({
        page: 0,
        size: 500,
        active: true,
      }),
      products: this.productsService.getProducts({
        page: 0,
        size: 1,
        active: true,
      }),
      recentInvoices: this.invoicesService.getInvoices({
        page: 0,
        size: 5,
        status: 'posted',
        kinds: ['invoice', 'credit_note'],
        sort: 'issueDate,desc',
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.revenue.set(
            data.monthInvoices.items.reduce((sum, invoice) => sum + signedTotal(invoice), 0),
          );
          this.outstanding.set(data.invoiceSummary.outstanding);
          this.overdue.set(data.invoiceSummary.overdue);
          this.paymentsMonth.set(
            data.monthPayments.items.reduce((sum, payment) => sum + payment.amount, 0),
          );
          this.stockValue.set(data.levels.reduce((sum, row) => sum + row.value, 0));
          this.stockItems.set(data.levels.length);
          this.customers.set(data.partners.items.filter((partner) => partner.isCustomer).length);
          this.products.set(data.products.total);
          this.pendingOrders.set(data.purchaseSummary.awaiting);
          this.lateOrders.set(data.purchaseSummary.late);
          this.recentInvoices.set(data.recentInvoices.items);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  invoiceTotal(invoice: Invoice): number {
    return invoiceTotals(invoice).totalTtc;
  }
}

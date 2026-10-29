import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { todayIso } from '../../../../shared/utils/money';
import { Invoice } from '../../../invoices/models/invoice';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { invoiceTotals } from '../../../invoices/utils/invoice-calc';
import { PaymentService } from '../../../payments/services/payment.service';

@Component({
  selector: 'app-accountant-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './accountant-dashboard.html',
  styleUrl: './accountant-dashboard.css',
})
export class AccountantDashboard {
  private readonly invoicesService = inject(InvoiceService);
  private readonly paymentsService = inject(PaymentService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  outstanding = signal(0);
  overdue = signal(0);
  paymentsMonth = signal(0);
  draftsToValidate = signal(0);
  recentInvoices = signal<Invoice[]>([]);

  loading = signal(true);
  loadFailed = signal(false);

  readonly quickActions = [
    { labelKey: 'dashboard.roles.accountant.quick.payment', icon: '💳', route: '/payments/new' },
    { labelKey: 'dashboard.roles.accountant.quick.payments', icon: '🧾', route: '/payments' },
    { labelKey: 'dashboard.roles.accountant.quick.invoices', icon: '🧮', route: '/invoices' },
    { labelKey: 'dashboard.roles.accountant.quick.accounting', icon: '📚', route: '/accounting' },
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
      invoiceSummary: this.invoicesService.getSummary(this.currency()),
      monthInvoices: this.invoicesService.getInvoices({
        page: 0,
        size: 1,
        status: 'draft',
      }),
      monthPayments: this.paymentsService.getPayments({
        page: 0,
        size: 500,
        from: monthStart,
        to: today,
      }),
      recentInvoices: this.invoicesService.getInvoices({
        page: 0,
        size: 5,
        status: 'posted',
        sort: 'issueDate,desc',
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.outstanding.set(data.invoiceSummary.outstanding);
          this.overdue.set(data.invoiceSummary.overdue);
          this.paymentsMonth.set(
            data.monthPayments.items.reduce((sum, payment) => sum + payment.amount, 0),
          );
          this.draftsToValidate.set(data.monthInvoices.total);
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

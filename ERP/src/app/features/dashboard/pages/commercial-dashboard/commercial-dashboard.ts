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

@Component({
  selector: 'app-commercial-dashboard',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './commercial-dashboard.html',
  styleUrl: './commercial-dashboard.css',
})
export class CommercialDashboard {
  private readonly invoicesService = inject(InvoiceService);
  private readonly partnersService = inject(PartnerService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  revenue = signal(0);
  monthCount = signal(0);
  outstanding = signal(0);
  overdue = signal(0);
  customers = signal(0);
  recentInvoices = signal<Invoice[]>([]);

  loading = signal(true);
  loadFailed = signal(false);

  readonly quickActions = [
    { labelKey: 'dashboard.quick.newInvoice', icon: '🧾', route: '/invoices/new' },
    { labelKey: 'dashboard.quick.newContact', icon: '👥', route: '/contacts/new' },
    { labelKey: 'dashboard.roles.commercial.quick.reminders', icon: '⏰', route: '/reminders' },
    { labelKey: 'dashboard.roles.commercial.quick.invoices', icon: '🧮', route: '/invoices' },
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
      partners: this.partnersService.getPartners({
        page: 0,
        size: 500,
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
          this.monthCount.set(data.monthInvoices.items.length);
          this.outstanding.set(data.invoiceSummary.outstanding);
          this.overdue.set(data.invoiceSummary.overdue);
          this.customers.set(data.partners.items.filter((partner) => partner.isCustomer).length);
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

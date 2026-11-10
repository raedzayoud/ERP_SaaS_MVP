import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { AdminApiService } from '../../services/admin-api.service';
import { PlatformTenant, SubscriptionPayment } from '../../models/platform';
import { getPlanById } from '../../../../core/data/plans';

type PaymentFilter = 'all' | 'paid' | 'pending' | 'overdue';

/** Overdue first, then pending, then paid. Newer periods on top. */
const STATUS_ORDER: Record<string, number> = { overdue: 0, pending: 1, paid: 2 };

@Component({
  selector: 'app-admin-payments',
  imports: [DatePipe, DecimalPipe, TranslocoDirective],
  templateUrl: './admin-payments.html',
  styleUrl: './admin-payments.css',
})
export class AdminPayments {
  private readonly adminApi = inject(AdminApiService);

  readonly paymentFilters: PaymentFilter[] = ['all', 'overdue', 'pending', 'paid'];

  payments = signal<SubscriptionPayment[]>([]);
  tenants = signal<PlatformTenant[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  filter = signal<PaymentFilter>('all');

  filtered = computed(() =>
    [...this.payments()
      .filter((p) => this.filter() === 'all' || p.status === this.filter())]
      .sort(
        (a, b) =>
          (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) ||
          b.period.localeCompare(a.period),
      ),
  );

  overdueAmount = computed(() =>
    this.payments()
      .filter((p) => p.status === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0),
  );

  monthlyRevenue = computed(() =>
    this.tenants()
      .filter((t) => t.status === 'active')
      .reduce((sum, t) => sum + getPlanById(t.planId).priceMonthly, 0),
  );

  collectedAmount = computed(() =>
    this.payments()
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + p.amount, 0),
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.adminApi.getPayments().subscribe({
      next: (payments) => {
        this.payments.set(payments);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      },
    });

    this.adminApi.getTenants().subscribe({
      next: (tenants) => this.tenants.set(tenants),
    });
  }

  setFilter(filter: PaymentFilter): void {
    this.filter.set(filter);
  }

  tenantOf(tenantId: string): PlatformTenant | undefined {
    return this.tenants().find((t) => t.id === tenantId);
  }

  tenantName(tenantId: string): string {
    return this.tenantOf(tenantId)?.companyName ?? '—';
  }

  tenantSubdomain(tenantId: string): string {
    return this.tenantOf(tenantId)?.subdomain ?? '';
  }

  planName(tenantId: string): string {
    const planId = this.tenantOf(tenantId)?.planId ?? 'starter';
    return getPlanById(planId).name;
  }

  statusClass(status: string): string {
    if (status === 'paid') return 'status-paid';
    if (status === 'overdue') return 'status-overdue';
    return 'status-pending';
  }
}

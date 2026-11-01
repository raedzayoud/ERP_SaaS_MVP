import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from '../../../../reports/components/chart-canvas/chart-canvas';
import { ReportData } from '../../../../reports/models/report';
import { ReportsService } from '../../../../reports/services/reports.service';
import { PaymentService } from '../../../../payments/services/payment.service';
import { TenantService } from '../../../../../core/services/tenant.service';

/** Granularity of the whole BI page. */
type AnalyticsPeriod = 'month' | 'quarter' | 'year';

/** First and last day of the calendar period containing today. */
function periodRange(period: AnalyticsPeriod): { from: string; to: string } {
  const now = new Date();
  // months are 0-based: month 0 = January.
  const year = now.getFullYear();
  if (period === 'month') {
    const start = new Date(year, now.getMonth(), 1);
    const end = new Date(year, now.getMonth() + 1, 0);
    return { from: dateIso(start), to: dateIso(end) };
  }

  if (period === 'quarter') {
    const quarterStart = now.getMonth() - (now.getMonth() % 3);
    return {
      from: dateIso(new Date(year, quarterStart, 1)),
      to: dateIso(new Date(year, quarterStart + 3, 0)),
    };
  }

  return { from: dateIso(new Date(year, 0, 1)), to: dateIso(new Date(year, 11, 31)) };
}

/** A local date as YYYY-MM-DD (ISO date, no time). */
function dateIso(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

@Component({
  selector: 'app-analytics',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, TranslocoDirective, ChartCanvas],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics {
  private readonly reports = inject(ReportsService);
  private readonly payments = inject(PaymentService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly period = signal<AnalyticsPeriod>('year');
  readonly periods: AnalyticsPeriod[] = ['month', 'quarter', 'year'];

  readonly rangeFrom = signal('');
  readonly rangeTo = signal('');

  readonly data = signal<ReportData | null>(null);
  /** Customer payments received inside the selected period. */
  readonly collected = signal(0);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  readonly salesChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const data = this.data();
    const months = data?.salesByMonth ?? [];
    return {
      labels: months.map((month) => month.label),
      datasets: [
        {
          data: months.map((month) => month.total),
          label: this.transloco.translate('analytics.charts.sales'),
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly topCustomersData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const rows = [...(this.data()?.customers ?? [])]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
    return {
      labels: rows.map((row) => row.name),
      datasets: [
        {
          data: rows.map((row) => row.revenue),
          label: this.transloco.translate('analytics.charts.customers'),
          backgroundColor: '#22c55e',
        },
      ],
    };
  });

  readonly paymentsChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const rows = this.data()?.paymentsByMode ?? [];
    return {
      labels: rows.map((row) => this.transloco.translate('payments.modes.' + row.mode)),
      datasets: [
        {
          data: rows.map((row) => row.total),
          label: this.transloco.translate('analytics.charts.payments'),
        },
      ],
    };
  });

  readonly flowsChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const data = this.data();
    return {
      labels: [
        this.transloco.translate('analytics.charts.flows.sales'),
        this.transloco.translate('analytics.charts.flows.expenses'),
      ],
      datasets: [
        {
          data: [data?.totalSales ?? 0, data?.totalExpenses ?? 0],
          label: '',
          backgroundColor: ['#2563eb', '#f97316'],
        },
      ],
    };
  });

  readonly lineOptions: ChartConfiguration<'line'>['options'] = {
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      x: { grid: { display: false } },
    },
  };

  readonly columnsOptions: ChartConfiguration<'bar'>['options'] = {
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      x: { grid: { display: false } },
    },
  };

  readonly donutOptions: ChartConfiguration<'doughnut'>['options'] = {
    plugins: { legend: { position: 'right' } },
    cutout: '60%',
  };

  readonly stackedOptions: ChartConfiguration<'bar'>['options'] = {
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      x: { grid: { display: false } },
    },
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const { from, to } = periodRange(this.period());
    this.rangeFrom.set(from);
    this.rangeTo.set(to);

    forkJoin({
      report: this.reports.getReportData(from, to),
      received: this.payments.getPayments({
        page: 0,
        size: 500,
        direction: 'in',
        from,
        to,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ report, received }) => {
          this.data.set(report);
          this.collected.set(received.items.reduce((sum, payment) => sum + payment.amount, 0));
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  switchPeriod(next: AnalyticsPeriod): void {
    if (next === this.period()) return;

    this.period.set(next);
    this.load();
  }

  isPeriod(period: AnalyticsPeriod): boolean {
    return this.period() === period;
  }
}

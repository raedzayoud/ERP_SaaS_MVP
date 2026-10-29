import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ChartConfiguration } from 'chart.js';
import { forkJoin } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { addDaysIso, todayIso } from '../../../../shared/utils/money';
import {
  NumberedDoc,
  NumberingFamily,
  analyzeNumbering,
} from '../../../../shared/utils/numbering-compliance';
import { ReportData } from '../../models/report';
import { ReportsService } from '../../services/reports.service';
import { ReportPdfService } from '../../services/report-pdf.service';
import { downloadCsv } from '../../utils/export-csv';
import { ChartCanvas } from '../../components/chart-canvas/chart-canvas';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { SalesOrderService } from '../../../sales/services/sales-order.service';
import { DeliveryNoteService } from '../../../sales/services/delivery-note.service';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { SupplierBillService } from '../../../purchases/services/supplier-bill.service';

type ReportTab = 'overview' | 'aging' | 'customers' | 'stock' | 'numbering';

const PRIMARY = '#714b67';
const ACCENT = '#017e84';
const DONUT_COLORS = [PRIMARY, ACCENT, '#b45309', '#3b82f6', '#6b7280'];

@Component({
  selector: 'app-reports',
  imports: [CurrencyPipe, DecimalPipe, TranslocoDirective, ChartCanvas],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class Reports {
  private readonly service = inject(ReportsService);
  private readonly pdfService = inject(ReportPdfService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly invoices = inject(InvoiceService);
  private readonly salesOrders = inject(SalesOrderService);
  private readonly deliveries = inject(DeliveryNoteService);
  private readonly purchases = inject(PurchaseService);
  private readonly supplierBills = inject(SupplierBillService);
  private readonly destroyRef = inject(DestroyRef);

  readonly from = signal(addDaysIso(todayIso(), -30));
  readonly to = signal(todayIso());

  readonly tabs: ReportTab[] = ['overview', 'aging', 'customers', 'stock', 'numbering'];
  readonly tab = signal<ReportTab>('overview');

  data = signal<ReportData | null>(null);
  loading = signal(true);
  loadFailed = signal(false);
  pdfBusy = signal(false);

  numbering = signal<NumberingFamily[]>([]);
  numberingLoading = signal(false);
  numberingFailed = signal(false);
  numberingLoaded = signal(false);

  /** The currency of the current workspace, used for all money displays. */
  readonly currency = computed(() => this.tenantService.activeCurrency());

  readonly salesChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const months = this.data()?.salesByMonth ?? [];
    return {
      labels: months.map((m) => m.label),
      datasets: [
        {
          label: this.transloco.translate('reports.kpi.sales'),
          data: months.map((m) => m.total),
          borderColor: PRIMARY,
          backgroundColor: PRIMARY + '20',
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: PRIMARY,
        },
      ],
    };
  });

  readonly donutChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const modes = this.data()?.paymentsByMode ?? [];
    return {
      labels: modes.map((m) => this.transloco.translate('payments.modes.' + m.mode)),
      datasets: [
        {
          data: modes.map((m) => m.total),
          backgroundColor: DONUT_COLORS,
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  });

  readonly barChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const products = this.data()?.topProducts ?? [];
    return {
      labels: products.map((p) => p.name),
      datasets: [
        {
          label: this.transloco.translate('reports.columns.revenue'),
          data: products.map((p) => p.revenue),
          backgroundColor: ACCENT,
          borderRadius: 4,
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

  readonly donutOptions: ChartConfiguration<'doughnut'>['options'] = {
    plugins: { legend: { position: 'right' } },
    cutout: '60%',
  };

  readonly barOptions: ChartConfiguration<'bar'>['options'] = {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      y: { grid: { display: false } },
    },
  };

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service
      .getReportData(this.from(), this.to())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.data.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onFromChange(event: Event): void {
    this.from.set((event.target as HTMLInputElement).value);
    this.load();
  }

  onToChange(event: Event): void {
    this.to.set((event.target as HTMLInputElement).value);
    this.load();
  }

  setTab(nextTab: ReportTab): void {
    this.tab.set(nextTab);
    if (nextTab === 'numbering' && !this.numberingLoaded()) {
      this.loadNumbering();
    }
  }

  /** Collects every numbered family once and checks its sequences. */
  loadNumbering(): void {
    if (this.numberingLoading()) return;

    this.numberingLoading.set(true);
    this.numberingFailed.set(false);

    forkJoin({
      invoices: this.invoices.getInvoices({ page: 0, size: 1000 }),
      salesOrders: this.salesOrders.getOrders({ page: 0, size: 1000 }),
      deliveries: this.deliveries.getDeliveries({ page: 0, size: 1000 }),
      purchaseOrders: this.purchases.getOrders({ page: 0, size: 1000 }),
      bills: this.supplierBills.getBills({ page: 0, size: 1000 }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ invoices, salesOrders, deliveries, purchaseOrders, bills }) => {
          const numberedInvoices = invoices.items.filter(
            (invoice) => invoice.number !== null,
          );
          const families: NumberingFamily[] = [
            {
              familyKey: 'reports.numbering.families.invoices',
              series: analyzeNumbering(
                this.toDocs(
                  numberedInvoices
                    .filter((invoice) => invoice.kind === 'invoice')
                    .map((invoice) => ({ number: invoice.number ?? '', date: invoice.issueDate })),
                ),
              ),
            },
            {
              familyKey: 'reports.numbering.families.credits',
              series: analyzeNumbering(
                this.toDocs(
                  numberedInvoices
                    .filter((invoice) => invoice.kind === 'credit_note')
                    .map((invoice) => ({ number: invoice.number ?? '', date: invoice.issueDate })),
                ),
              ),
            },
            {
              familyKey: 'reports.numbering.families.quotes',
              series: analyzeNumbering(
                this.toDocs(
                  numberedInvoices
                    .filter((invoice) => invoice.kind === 'quote')
                    .map((invoice) => ({ number: invoice.number ?? '', date: invoice.issueDate })),
                ),
              ),
            },
            {
              familyKey: 'reports.numbering.families.salesOrders',
              series: analyzeNumbering(
                this.toDocs(
                  salesOrders.items
                    .filter((order) => order.number !== null)
                    .map((order) => ({ number: order.number ?? '', date: order.orderDate })),
                ),
              ),
            },
            {
              familyKey: 'reports.numbering.families.deliveries',
              series: analyzeNumbering(
                deliveries.items.map((note) => ({
                  number: note.number,
                  date: note.deliveryDate,
                })),
              ),
            },
            {
              familyKey: 'reports.numbering.families.purchaseOrders',
              series: analyzeNumbering(
                this.toDocs(
                  purchaseOrders.items
                    .filter((order) => order.number !== null)
                    .map((order) => ({ number: order.number ?? '', date: order.orderDate })),
                ),
              ),
            },
            {
              familyKey: 'reports.numbering.families.supplierBills',
              series: analyzeNumbering(
                bills.items.map((bill) => ({
                  number: bill.number,
                  date: bill.billingDate,
                })),
              ),
            },
          ];

          this.numbering.set(families);
          this.numberingLoaded.set(true);
          this.numberingLoading.set(false);
        },
        error: () => {
          this.numberingFailed.set(true);
          this.numberingLoading.set(false);
        },
      });
  }

  /** One doc per numbered entry (the analyzer skips blank numbers). */
  private toDocs(entries: { number: string; date: string }[]): NumberedDoc[] {
    return entries;
  }

  async exportPdf(): Promise<void> {
    const data = this.data();
    if (!data) return;

    this.pdfBusy.set(true);
    const tenant = this.tenantService.currentTenant();

    try {
      await this.pdfService.download(data, {
        from: this.from(),
        to: this.to(),
        locale: this.transloco.getActiveLang(),
        companyName: tenant?.companyName ?? '',
        translate: (key, params) => this.transloco.translate(key, params),
      });
    } finally {
      this.pdfBusy.set(false);
    }
  }

  exportCsv(): void {
    const data = this.data();
    if (!data) return;

    const t = (key: string) => this.transloco.translate(key);
    const rows: (string | number)[][] = [
      [t('reports.pdf.title'), `${this.from()} — ${this.to()}`],
      [t('reports.tabs.' + this.tab())],
    ];

    if (this.tab() === 'overview') {
      rows.push(
        [t('reports.kpi.title')],
        [t('reports.kpi.sales'), data.totalSales],
        [t('reports.kpi.expenses'), data.totalExpenses],
        [t('reports.kpi.stockValue'), data.stockValue],
        [t('reports.kpi.outstanding'), data.outstanding],
        [t('reports.kpi.overdue'), data.overdue],
        [],
        [t('reports.sections.salesByMonth')],
        [t('reports.columns.month'), t('reports.columns.total')],
        ...data.salesByMonth.map((row) => [row.label, row.total]),
        [],
        [t('reports.sections.topProducts')],
        [t('reports.columns.product'), t('reports.columns.quantity'), t('reports.columns.revenue')],
        ...data.topProducts.map((row) => [row.name, row.quantity, row.revenue]),
        [],
        [t('reports.sections.margins')],
        [t('reports.columns.product'), t('reports.columns.quantity'), t('reports.columns.margin')],
        ...data.margins.map((row) => [row.name, row.quantity, row.margin]),
      );
    } else if (this.tab() === 'aging') {
      rows.push(
        [t('reports.aging.columns.bucket'), t('reports.columns.count'), t('reports.columns.total')],
        ...data.aging.map((row) => [t('reports.aging.buckets.' + row.bucket), row.count, row.total]),
      );
    } else if (this.tab() === 'customers') {
      rows.push(
        [t('reports.columns.customer'), t('reports.columns.count'), t('reports.columns.revenue')],
        ...data.customers.map((row) => [row.name, row.invoices, row.revenue]),
      );
    } else {
      rows.push(
        [
          t('reports.columns.product'),
          t('reports.stock.columns.quantity'),
          t('reports.stock.columns.minStock'),
          t('reports.stock.columns.state'),
        ],
        ...data.stockRows.map((row) => [
          row.name,
          row.quantity,
          row.minStock,
          t(row.low ? 'reports.stock.low' : 'reports.stock.ok'),
        ]),
      );
    }

    downloadCsv(`reports-${this.tab()}-${this.from()}-${this.to()}.csv`, rows);
  }
}

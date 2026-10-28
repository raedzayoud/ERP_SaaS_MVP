import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { lineTotals, roundMoney } from '../../../shared/utils/money';
import { Invoice } from '../../invoices/models/invoice';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { invoiceTotals } from '../../invoices/utils/invoice-calc';
import { Payment } from '../../payments/models/payment';
import { PaymentService } from '../../payments/services/payment.service';
import { PurchaseOrder } from '../../purchases/models/purchase-order';
import { PurchaseService } from '../../purchases/services/purchase.service';
import { purchaseTotals } from '../../purchases/utils/purchase-calc';
import { StockMovementRow } from '../../stock/models/stock-movement';
import { StockService } from '../../stock/services/stock.service';
import { Product } from '../../products/models/product';
import { ProductService } from '../../products/services/product.service';
import {
  Account,
  CHART_OF_ACCOUNTS,
  JournalEntry,
  JournalLine,
  JournalQuery,
  TrialBalanceRow,
} from '../models/journal';

const LATENCY_MS = 300;

interface Sources {
  invoices: Invoice[];
  payments: Payment[];
  orders: PurchaseOrder[];
  adjustments: StockMovementRow[];
  products: Product[];
}

@Injectable({ providedIn: 'root' })
export class AccountingService {
  private readonly invoicesService = inject(InvoiceService);
  private readonly paymentsService = inject(PaymentService);
  private readonly purchasesService = inject(PurchaseService);
  private readonly stockService = inject(StockService);
  private readonly productsService = inject(ProductService);

  getJournalEntries(query: JournalQuery): Observable<Page<JournalEntry>> {
    return this.buildEntries().pipe(
      map((entries) => {
        const filtered = this.filterEntries(entries, query);
        const size = query.size > 0 ? query.size : 10;
        return {
          items: filtered.slice(query.page * size, query.page * size + size),
          total: filtered.length,
          page: query.page,
          size,
        };
      }),
    );
  }

  getJournalEntry(id: string): Observable<JournalEntry | undefined> {
    return this.buildEntries().pipe(map((entries) => entries.find((entry) => entry.id === id)));
  }

  getChartOfAccounts(): Observable<Account[]> {
    return timer(LATENCY_MS).pipe(map(() => CHART_OF_ACCOUNTS));
  }

  getTrialBalance(from?: string, to?: string): Observable<TrialBalanceRow[]> {
    return this.buildEntries().pipe(
      map((entries) => {
        const totals = new Map<string, { debit: number; credit: number }>();
        for (const account of CHART_OF_ACCOUNTS) {
          totals.set(account.code, { debit: 0, credit: 0 });
        }

        for (const entry of entries) {
          if (from && entry.date < from) continue;
          if (to && entry.date > to) continue;
          for (const line of entry.lines) {
            const bucket = totals.get(line.accountCode);
            if (!bucket) continue;
            bucket.debit += line.debit;
            bucket.credit += line.credit;
          }
        }

        const currency = 'USD';
        return CHART_OF_ACCOUNTS.map((account) => {
          const bucket = totals.get(account.code) ?? { debit: 0, credit: 0 };
          const debit = roundMoney(bucket.debit, currency);
          const credit = roundMoney(bucket.credit, currency);
          return {
            code: account.code,
            debit,
            credit,
            balance: roundMoney(debit - credit, currency),
          };
        });
      }),
    );
  }

  private buildEntries(): Observable<JournalEntry[]> {
    return forkJoin({
      invoices: this.invoicesService.getInvoices({
        page: 0,
        size: 500,
        status: 'posted',
        kinds: ['invoice', 'credit_note'],
      }),
      payments: this.paymentsService.getPayments({ page: 0, size: 500 }),
      orders: this.purchasesService.getOrders({
        page: 0,
        size: 500,
        status: 'confirmed',
      }),
      adjustments: this.stockService.getMovements({
        page: 0,
        size: 500,
        type: 'adjustment',
      }),
      products: this.productsService.getProducts({ page: 0, size: 500 }),
    }).pipe(
      map((data) => {
        const sources: Sources = {
          invoices: data.invoices.items,
          payments: data.payments.items,
          orders: data.orders.items,
          adjustments: data.adjustments.items,
          products: data.products.items,
        };
        return this.entriesFrom(sources);
      }),
    );
  }

  private entriesFrom(sources: Sources): JournalEntry[] {
    const fromAdjustments = sources.adjustments
      .map((movement) => this.fromAdjustment(movement, sources.products))
      .filter((entry): entry is JournalEntry => entry !== null);

    const entries: JournalEntry[] = [
      ...sources.invoices.map((invoice) => this.fromInvoice(invoice, sources.products)),
      ...sources.payments.map((payment) => this.fromPayment(payment)),
      ...sources.orders.map((order) => this.fromOrder(order)),
      ...fromAdjustments,
    ];

    return entries.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  }

  private fromInvoice(invoice: Invoice, products: Product[]): JournalEntry {
    const totals = invoiceTotals(invoice);
    const currency = invoice.currency;
    const isCreditNote = invoice.kind === 'credit_note';

    const productTypes = new Map(products.map((product) => [product.id, product.type]));
    let goodsNet = 0;
    for (const line of invoice.lines) {
      const net = lineTotals(line, currency).net;
      if (line.productId && productTypes.get(line.productId) === 'good') {
        goodsNet += net;
      }
    }
    const servicesNet = roundMoney(totals.totalNet - goodsNet, currency);
    goodsNet = roundMoney(goodsNet, currency);

    const lines: JournalLine[] = isCreditNote
      ? [
          this.line('411000', 0, totals.totalToPay),
          this.line('701000', goodsNet, 0),
          this.line('706000', servicesNet, 0),
          this.line('445710', totals.totalVat, 0),
        ]
      : [
          this.line('411000', totals.totalToPay, 0),
          this.line('701000', 0, goodsNet),
          this.line('706000', 0, servicesNet),
          this.line('445710', 0, totals.totalVat),
        ];

    return {
      id: `inv:${invoice.id}`,
      date: invoice.issueDate,
      journal: 'SALES',
      ref: invoice.number ?? '—',
      label: invoice.customerSnapshot?.name ?? '',
      lines: this.dropZeroLines(lines),
      currency,
    };
  }

  private fromPayment(payment: Payment): JournalEntry {
    const accountCode = payment.mode === 'cash' ? '530000' : '512000';

    if (payment.direction === 'out') {
      return {
        id: `pay:${payment.id}`,
        date: payment.date,
        journal: 'PAYMENTS',
        ref: payment.invoiceNumber || payment.reference || '—',
        label: payment.partnerName,
        lines: [this.line('401000', payment.amount, 0), this.line(accountCode, 0, payment.amount)],
        currency: payment.currency,
      };
    }

    return {
      id: `pay:${payment.id}`,
      date: payment.date,
      journal: 'PAYMENTS',
      ref: payment.invoiceNumber || payment.reference || '—',
      label: payment.partnerName,
      lines: [this.line(accountCode, payment.amount, 0), this.line('411000', 0, payment.amount)],
      currency: payment.currency,
    };
  }

  private fromOrder(order: PurchaseOrder): JournalEntry {
    const totals = purchaseTotals(order.lines, order.currency);

    return {
      id: `po:${order.id}`,
      date: order.orderDate,
      journal: 'PURCHASES',
      ref: order.number ?? '—',
      label: order.supplierSnapshot?.name ?? '',
      lines: [
        this.line('601000', totals.totalNet, 0),
        this.line('445660', totals.totalVat, 0),
        this.line('401000', 0, totals.totalTtc),
      ],
      currency: order.currency,
    };
  }

  private fromAdjustment(movement: StockMovementRow, products: Product[]): JournalEntry | null {
    const product = products.find((item) => item.id === movement.productId);
    if (!product) return null;

    const value = roundMoney(movement.quantity * product.purchasePrice, 'USD');
    if (value <= 0) return null;

    const lines =
      movement.direction === 'in'
        ? [this.line('310000', value, 0), this.line('793000', 0, value)]
        : [this.line('693000', value, 0), this.line('310000', 0, value)];

    return {
      id: `adj:${movement.id}`,
      date: movement.date,
      journal: 'STOCK',
      ref: movement.productSku,
      label: movement.reason,
      lines,
      currency: 'USD',
    };
  }

  private line(accountCode: string, debit: number, credit: number): JournalLine {
    return {
      id: `${accountCode}-${debit}-${credit}`,
      accountCode,
      debit: roundMoney(debit, 'USD'),
      credit: roundMoney(credit, 'USD'),
    };
  }

  private dropZeroLines(lines: JournalLine[]): JournalLine[] {
    return lines.filter((line) => line.debit !== 0 || line.credit !== 0);
  }

  private filterEntries(entries: JournalEntry[], query: JournalQuery): JournalEntry[] {
    const search = query.search?.trim().toLowerCase();

    return entries.filter((entry) => {
      if (query.journal && entry.journal !== query.journal) return false;
      if (query.from && entry.date < query.from) return false;
      if (query.to && entry.date > query.to) return false;
      if (search) {
        const haystack = `${entry.ref} ${entry.label}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }
}

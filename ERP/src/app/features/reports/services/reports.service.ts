import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map } from 'rxjs';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { PaymentService } from '../../payments/services/payment.service';
import { PurchaseService } from '../../purchases/services/purchase.service';
import { ProductService } from '../../products/services/product.service';
import { StockService } from '../../stock/services/stock.service';
import { AccountingService } from '../../accounting/services/accounting.service';
import { Invoice } from '../../invoices/models/invoice';
import { PurchaseOrder } from '../../purchases/models/purchase-order';
import { signedTotal } from '../../invoices/utils/invoice-calc';
import { purchaseTotals } from '../../purchases/utils/purchase-calc';
import { roundMoney } from '../../../shared/utils/money';
import {
  MarginRow,
  PaymentsByMode,
  ReportData,
  SalesByMonth,
  TopProduct,
  TrialBalanceRow,
} from '../models/report';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly invoices = inject(InvoiceService);
  private readonly payments = inject(PaymentService);
  private readonly purchases = inject(PurchaseService);
  private readonly products = inject(ProductService);
  private readonly stock = inject(StockService);
  private readonly accounting = inject(AccountingService);

  getReportData(from: string, to: string): Observable<ReportData> {
    return forkJoin({
      invoices: this.invoices.getInvoices({ page: 0, size: 500, status: 'posted' }),
      payments: this.payments.getPayments({ page: 0, size: 500, from, to }),
      orders: this.purchases.getOrders({ page: 0, size: 500, status: 'confirmed' }),
      products: this.products.getProducts({ page: 0, size: 500 }),
      levels: this.stock.getLevels({}),
      trialBalance: this.accounting.getTrialBalance(),
      summary: this.invoices.getSummary('USD'),
    }).pipe(map((data) => this.aggregate(data, from, to)));
  }

  private aggregate(
    data: {
      invoices: { items: Invoice[] };
      payments: { items: { mode: string; amount: number }[] };
      orders: { items: PurchaseOrder[] };
      products: { items: { id: string; name: string; purchasePrice: number }[] };
      levels: { value: number }[];
      trialBalance: TrialBalanceRow[];
      summary: { outstanding: number; overdue: number };
    },
    from: string,
    to: string,
  ): ReportData {
    const docs = data.invoices.items.filter(
      (inv) => inv.kind !== 'quote' && inv.issueDate >= from && inv.issueDate <= to,
    );

    const salesByMonth = this.buildSalesByMonth(docs, from, to);
    const topProducts = this.buildTopProducts(docs, data.products.items);
    const margins = this.buildMargins(docs, data.products.items);
    const paymentsByMode = this.buildPaymentsByMode(data.payments.items);

    const totalSales = docs.reduce((sum, inv) => sum + signedTotal(inv), 0);
    const totalExpenses = data.orders.items
      .filter((order) => order.orderDate >= from && order.orderDate <= to)
      .reduce((sum, order) => sum + purchaseTotals(order.lines, order.currency).totalTtc, 0);
    const stockValue = data.levels.reduce((sum, level) => sum + level.value, 0);

    return {
      salesByMonth,
      topProducts,
      paymentsByMode,
      margins,
      trialBalance: data.trialBalance,
      totalSales: roundMoney(totalSales, 'USD'),
      totalExpenses: roundMoney(totalExpenses, 'USD'),
      stockValue: roundMoney(stockValue, 'USD'),
      outstanding: data.summary.outstanding,
      overdue: data.summary.overdue,
    };
  }

  private buildSalesByMonth(docs: Invoice[], from: string, to: string): SalesByMonth[] {
    const months: SalesByMonth[] = [];
    const start = new Date(from);
    const end = new Date(to);

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      const label = cursor.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const total = docs
        .filter((inv) => inv.issueDate.startsWith(monthKey))
        .reduce((sum, inv) => sum + signedTotal(inv), 0);
      months.push({ month: monthKey, label, total: roundMoney(total, 'USD') });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return months;
  }

  private buildTopProducts(
    docs: Invoice[],
    products: { id: string; name: string }[],
  ): TopProduct[] {
    const byProduct = new Map<string, TopProduct>();

    for (const doc of docs) {
      for (const line of doc.lines) {
        if (!line.productId) continue;
        const product = products.find((p) => p.id === line.productId);
        if (!product) continue;

        const existing = byProduct.get(line.productId) ?? {
          productId: line.productId,
          name: product.name,
          quantity: 0,
          revenue: 0,
        };
        existing.quantity += line.quantity;
        existing.revenue += line.quantity * line.unitPrice * (1 - line.discountPct / 100);
        byProduct.set(line.productId, existing);
      }
    }

    return [...byProduct.values()]
      .map((row) => ({ ...row, revenue: roundMoney(row.revenue, 'USD') }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  private buildMargins(
    docs: Invoice[],
    products: { id: string; name: string; purchasePrice: number }[],
  ): MarginRow[] {
    const byProduct = new Map<string, MarginRow>();

    for (const doc of docs) {
      for (const line of doc.lines) {
        if (!line.productId) continue;
        const product = products.find((p) => p.id === line.productId);
        if (!product) continue;

        const existing = byProduct.get(line.productId) ?? {
          productId: line.productId,
          name: product.name,
          quantity: 0,
          margin: 0,
        };
        existing.quantity += line.quantity;
        existing.margin +=
          line.quantity * (line.unitPrice * (1 - line.discountPct / 100) - product.purchasePrice);
        byProduct.set(line.productId, existing);
      }
    }

    return [...byProduct.values()]
      .map((row) => ({ ...row, margin: roundMoney(row.margin, 'USD') }))
      .sort((a, b) => b.margin - a.margin)
      .slice(0, 5);
  }

  private buildPaymentsByMode(payments: { mode: string; amount: number }[]): PaymentsByMode[] {
    const byMode = new Map<string, PaymentsByMode>();

    for (const payment of payments) {
      const existing = byMode.get(payment.mode) ?? { mode: payment.mode, count: 0, total: 0 };
      existing.count += 1;
      existing.total += payment.amount;
      byMode.set(payment.mode, existing);
    }

    return [...byMode.values()]
      .map((row) => ({ ...row, total: roundMoney(row.total, 'USD') }))
      .sort((a, b) => b.total - a.total);
  }
}

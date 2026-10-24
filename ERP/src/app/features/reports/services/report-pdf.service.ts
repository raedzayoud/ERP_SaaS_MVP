import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import { formatMoney } from '../../../shared/utils/money';
import { ReportData } from '../models/report';

const MARGIN = 15;
const PRIMARY = [113, 75, 103] as const;
const INK = [31, 41, 55] as const;
const MUTED = [107, 114, 128] as const;

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

export interface ReportPdfContext {
  from: string;
  to: string;
  locale: string;
  companyName: string;
  translate: TranslateFn;
}

@Injectable({ providedIn: 'root' })
export class ReportPdfService {
  async download(data: ReportData, context: ReportPdfContext): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const money = (value: number) => formatMoney(value, 'USD', context.locale);

    let y = this.drawHeader(doc, context);
    y = this.drawKpis(doc, data, context, y, money);
    y = this.drawSales(doc, data, context, y, money, autoTable);
    y = this.drawTopProducts(doc, data, context, y, money, autoTable);

    doc.save(`reports-${context.from}-${context.to}.pdf`);
  }

  private drawHeader(doc: jsPDF, ctx: ReportPdfContext): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(16)
      .setTextColor(...INK);
    doc.text(ctx.translate('reports.pdf.title'), MARGIN, MARGIN + 6);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(...MUTED);
    doc.text(ctx.companyName, MARGIN, MARGIN + 12);
    doc.text(`${ctx.from} — ${ctx.to}`, MARGIN, MARGIN + 17);

    return MARGIN + 25;
  }

  private drawKpis(
    doc: jsPDF,
    data: ReportData,
    ctx: ReportPdfContext,
    startY: number,
    money: (value: number) => string,
  ): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(12)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate('reports.kpi.title'), MARGIN, startY);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(10)
      .setTextColor(...INK);
    const rows: [string, string][] = [
      [ctx.translate('reports.kpi.sales'), money(data.totalSales)],
      [ctx.translate('reports.kpi.expenses'), money(data.totalExpenses)],
      [ctx.translate('reports.kpi.stockValue'), money(data.stockValue)],
      [ctx.translate('reports.kpi.outstanding'), money(data.outstanding)],
      [ctx.translate('reports.kpi.overdue'), money(data.overdue)],
    ];

    let y = startY + 8;
    for (const [label, value] of rows) {
      doc.text(label, MARGIN, y);
      doc.text(value, 100, y, { align: 'right' });
      y += 6;
    }

    return y + 4;
  }

  private drawSales(
    doc: jsPDF,
    data: ReportData,
    ctx: ReportPdfContext,
    startY: number,
    money: (value: number) => string,
    autoTable: (doc: jsPDF, options: Record<string, unknown>) => void,
  ): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(12)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate('reports.sections.salesByMonth'), MARGIN, startY);

    autoTable(doc, {
      startY: startY + 4,
      head: [[ctx.translate('reports.columns.month'), ctx.translate('reports.columns.total')]],
      body: data.salesByMonth.map((row) => [row.label, money(row.total)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY as unknown as number[] },
    });

    return (
      (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY + 20
    );
  }

  private drawTopProducts(
    doc: jsPDF,
    data: ReportData,
    ctx: ReportPdfContext,
    startY: number,
    money: (value: number) => string,
    autoTable: (doc: jsPDF, options: Record<string, unknown>) => void,
  ): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(12)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate('reports.sections.topProducts'), MARGIN, startY + 6);

    autoTable(doc, {
      startY: startY + 10,
      head: [
        [
          ctx.translate('reports.columns.product'),
          ctx.translate('reports.columns.quantity'),
          ctx.translate('reports.columns.revenue'),
        ],
      ],
      body: data.topProducts.map((row) => [row.name, String(row.quantity), money(row.revenue)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: PRIMARY as unknown as number[] },
    });

    return (
      (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? startY + 30
    );
  }
}

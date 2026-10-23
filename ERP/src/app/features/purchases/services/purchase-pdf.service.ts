import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import {
  VatGroup,
  formatDate,
  formatMoney,
  formatNumber,
  lineTotals,
} from '../../../shared/utils/money';
import { PurchaseLine, PurchaseOrder } from '../models/purchase-order';
import { PurchaseTotals, purchaseTotals } from '../utils/purchase-calc';

const MARGIN = 15;
const PAGE_WIDTH = 210;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const PRIMARY = [113, 75, 103] as const;
const INK = [31, 41, 55] as const;
const MUTED = [107, 114, 128] as const;
const BORDER = [229, 231, 235] as const;
const SOFT_FILL = [249, 250, 251] as const;

export type TranslateFn = (key: string, params?: Record<string, unknown>) => string;
type AutoTableFn = (doc: jsPDF, options: UserOptions) => void;

export interface PdfContext {
  buyerName: string;
  buyerAddress: string;
  buyerTaxId: string;
  locale: string;
  translate: TranslateFn;
}

interface TotalsRow {
  key: string;
  value: string;
  params?: Record<string, unknown>;
  strong?: boolean;
}

interface AutoTableHolder {
  lastAutoTable?: { finalY?: number };
}

@Injectable({ providedIn: 'root' })
export class PurchasePdfService {
  async download(order: PurchaseOrder, context: PdfContext): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const totals = purchaseTotals(order.lines, order.currency);
    const money = (value: number) => formatMoney(value, order.currency, context.locale);
    const qty = (value: number) => formatNumber(value, context.locale);

    const headerY = this.drawHeader(doc, order, context);
    const partiesY = this.drawParties(doc, order, context, headerY);
    const tableY = this.drawLines(doc, order, context, partiesY, money, qty, autoTable);
    const totalsY = this.drawTotals(doc, totals, context, tableY, money);
    this.drawNotes(doc, order, context, totalsY);
    this.drawFooters(doc, order, context);

    doc.save(`${order.number ?? 'draft'}.pdf`);
  }

  private drawHeader(doc: jsPDF, order: PurchaseOrder, ctx: PdfContext): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(16)
      .setTextColor(...INK);
    doc.text(ctx.buyerName, MARGIN, MARGIN + 6);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(...MUTED);
    if (ctx.buyerAddress) doc.text(ctx.buyerAddress, MARGIN, MARGIN + 12);
    if (ctx.buyerTaxId) {
      doc.text(`${ctx.translate('purchases.pdf.taxId')}: ${ctx.buyerTaxId}`, MARGIN, MARGIN + 17);
    }

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(18)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate('purchases.pdf.title'), PAGE_WIDTH - MARGIN, MARGIN + 6, {
      align: 'right',
    });

    doc.setFontSize(12).setTextColor(...INK);
    doc.text(order.number ?? '', PAGE_WIDTH - MARGIN, MARGIN + 14, { align: 'right' });

    return MARGIN + 26;
  }

  private drawParties(doc: jsPDF, order: PurchaseOrder, ctx: PdfContext, startY: number): number {
    const boxHeight = 34;
    const supplierWidth = 100;
    const datesWidth = 76;
    const datesX = PAGE_WIDTH - MARGIN - datesWidth;

    doc.setFillColor(...SOFT_FILL).setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, startY, supplierWidth, boxHeight, 2, 2, 'FD');

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(7)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('purchases.pdf.supplier').toUpperCase(), MARGIN + 4, startY + 6);

    doc.setFontSize(10).setTextColor(...INK);
    doc.text(order.supplierSnapshot?.name ?? '', MARGIN + 4, startY + 13);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8)
      .setTextColor(...MUTED);
    const address = order.supplierSnapshot?.address ?? '';
    if (address) {
      const lines = doc.splitTextToSize(address, supplierWidth - 8) as string[];
      doc.text(lines, MARGIN + 4, startY + 19);
    }

    const taxId = order.supplierSnapshot?.taxId ?? '';
    if (taxId) {
      doc.text(`${ctx.translate('purchases.pdf.taxId')}: ${taxId}`, MARGIN + 4, startY + 30);
    }

    const rows: [string, string][] = [
      [ctx.translate('purchases.pdf.orderDate'), formatDate(order.orderDate, ctx.locale)],
      [ctx.translate('purchases.pdf.expectedDate'), formatDate(order.expectedDate, ctx.locale)],
      [
        ctx.translate('purchases.pdf.paymentTerms'),
        ctx.translate(`invoices.terms.${order.paymentTerms}`),
      ],
    ];

    doc.setFontSize(8.5);
    rows.forEach(([label, value], index) => {
      const rowY = startY + 8 + index * 9;
      doc.setTextColor(...MUTED).text(label, datesX, rowY);
      doc.setTextColor(...INK).text(value, PAGE_WIDTH - MARGIN, rowY, { align: 'right' });
    });

    return startY + boxHeight + 8;
  }

  private drawLines(
    doc: jsPDF,
    order: PurchaseOrder,
    ctx: PdfContext,
    startY: number,
    money: (value: number) => string,
    qty: (value: number) => string,
    autoTable: AutoTableFn,
  ): number {
    const body = order.lines.map((line, index) => this.lineRow(line, index, order, money, qty));

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 20 },
      theme: 'grid',
      head: [
        [
          ctx.translate('purchases.pdf.colNo'),
          ctx.translate('purchases.pdf.colRef'),
          ctx.translate('purchases.pdf.colDescription'),
          ctx.translate('purchases.pdf.colQuantity'),
          ctx.translate('purchases.pdf.colUnitCost'),
          ctx.translate('purchases.pdf.colDiscount'),
          ctx.translate('purchases.pdf.colNet'),
          ctx.translate('purchases.pdf.colVatRate'),
        ],
      ],
      body,
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2,
        textColor: [...INK],
        lineColor: [...BORDER],
        lineWidth: 0.1,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: [...PRIMARY],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [...SOFT_FILL] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 20 },
        3: { cellWidth: 16, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 16, halign: 'right' },
        6: { cellWidth: 24, halign: 'right' },
        7: { cellWidth: 13, halign: 'right' },
      },
    });

    return readFinalY(doc, startY);
  }

  private lineRow(
    line: PurchaseLine,
    index: number,
    order: PurchaseOrder,
    money: (value: number) => string,
    qty: (value: number) => string,
  ): string[] {
    const { net } = lineTotals(
      {
        quantity: line.quantity,
        unitPrice: line.unitCost,
        discountPct: line.discountPct,
        vatRate: line.vatRate,
      },
      order.currency,
    );
    return [
      String(index + 1),
      line.reference,
      line.description,
      qty(line.quantity),
      money(line.unitCost),
      `${line.discountPct} %`,
      money(net),
      `${line.vatRate} %`,
    ];
  }

  private drawTotals(
    doc: jsPDF,
    totals: PurchaseTotals,
    ctx: PdfContext,
    startY: number,
    money: (value: number) => string,
  ): number {
    const blockWidth = 90;
    const x = PAGE_WIDTH - MARGIN - blockWidth;
    let y = startY + 8;

    const rows: TotalsRow[] = [
      { key: 'purchases.form.totals.net', value: money(totals.totalNet) },
      ...totals.vatByRate.map((group: VatGroup) => ({
        key: 'purchases.form.totals.vatRate',
        value: money(group.vat),
        params: { rate: group.rate },
      })),
      { key: 'purchases.form.totals.vat', value: money(totals.totalVat) },
      { key: 'purchases.form.totals.totalTtc', value: money(totals.totalTtc), strong: true },
    ];

    for (const row of rows) {
      doc.setFont('helvetica', row.strong ? 'bold' : 'normal');
      doc.setFontSize(row.strong ? 10 : 9);
      doc.setTextColor(...MUTED);
      doc.text(ctx.translate(row.key, row.params), x, y);
      doc.setTextColor(...INK);
      doc.text(row.value, PAGE_WIDTH - MARGIN, y, { align: 'right' });
      y += row.strong ? 7 : 6;
    }

    return y;
  }

  private drawNotes(doc: jsPDF, order: PurchaseOrder, ctx: PdfContext, startY: number): void {
    if (!order.notes.trim()) return;

    const y = startY + 6;
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(8)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('purchases.pdf.notes').toUpperCase(), MARGIN, y);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8.5)
      .setTextColor(...INK);
    const lines = doc.splitTextToSize(order.notes, CONTENT_WIDTH) as string[];
    doc.text(lines, MARGIN, y + 5);
  }

  private drawFooters(doc: jsPDF, order: PurchaseOrder, ctx: PdfContext): void {
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(8)
        .setTextColor(...MUTED);
      doc.text(order.number ?? '', MARGIN, 291);
      doc.text(
        `${ctx.translate('purchases.pdf.page')} ${page} / ${pages}`,
        PAGE_WIDTH - MARGIN,
        291,
        { align: 'right' },
      );
    }
  }
}

function readFinalY(doc: jsPDF, fallback: number): number {
  const holder = doc as unknown as AutoTableHolder;
  return holder.lastAutoTable?.finalY ?? fallback;
}

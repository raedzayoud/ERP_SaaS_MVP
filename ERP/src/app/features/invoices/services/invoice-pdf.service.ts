import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import {
  LineTotals,
  VatGroup,
  formatDate,
  formatMoney,
  formatNumber,
  lineTotals,
} from '../../../shared/utils/money';
import { Invoice, InvoiceLine } from '../models/invoice';
import { InvoiceTotals, invoiceTotals } from '../utils/invoice-calc';

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
  sellerName: string;
  sellerAddress: string;
  sellerTaxId: string;
  locale: string;
  translate: TranslateFn;
}

interface TotalsRow {
  key: string;
  value: string;
  params?: Record<string, unknown>;
  strong?: boolean;
  primary?: boolean;
}

interface AutoTableHolder {
  lastAutoTable?: { finalY?: number };
}

@Injectable({ providedIn: 'root' })
export class InvoicePdfService {
  async download(invoice: Invoice, context: PdfContext): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const totals = invoiceTotals(invoice);
    const money = (value: number) => formatMoney(value, invoice.currency, context.locale);
    const qty = (value: number) => formatNumber(value, context.locale);

    const headerY = this.drawHeader(doc, invoice, context);
    const partiesY = this.drawParties(doc, invoice, context, headerY);
    const tableY = this.drawLines(doc, invoice, context, partiesY, money, qty, autoTable);
    const totalsY = this.drawTotals(doc, totals, context, tableY, money);
    this.drawNotes(doc, invoice, context, totalsY);
    this.drawFooters(doc, invoice, context);

    doc.save(`${invoice.number ?? 'draft'}.pdf`);
  }

  private drawHeader(doc: jsPDF, invoice: Invoice, ctx: PdfContext): number {
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(16)
      .setTextColor(...INK);
    doc.text(ctx.sellerName, MARGIN, MARGIN + 6);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(9)
      .setTextColor(...MUTED);
    if (ctx.sellerAddress) doc.text(ctx.sellerAddress, MARGIN, MARGIN + 12);
    if (ctx.sellerTaxId) {
      doc.text(`${ctx.translate('invoices.pdf.taxId')}: ${ctx.sellerTaxId}`, MARGIN, MARGIN + 17);
    }

    const titleKey =
      invoice.kind === 'credit_note' ? 'invoices.kind.credit_note' : 'invoices.kind.invoice';
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(18)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate(titleKey), PAGE_WIDTH - MARGIN, MARGIN + 6, { align: 'right' });

    doc.setFontSize(12).setTextColor(...INK);
    doc.text(invoice.number ?? '', PAGE_WIDTH - MARGIN, MARGIN + 14, { align: 'right' });

    return MARGIN + 26;
  }

  private drawParties(doc: jsPDF, invoice: Invoice, ctx: PdfContext, startY: number): number {
    const boxHeight = 34;
    const customerWidth = 100;
    const datesWidth = 76;
    const datesX = PAGE_WIDTH - MARGIN - datesWidth;

    doc.setFillColor(...SOFT_FILL).setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, startY, customerWidth, boxHeight, 2, 2, 'FD');

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(7)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('invoices.pdf.billTo').toUpperCase(), MARGIN + 4, startY + 6);

    doc.setFontSize(10).setTextColor(...INK);
    doc.text(invoice.customerSnapshot?.name ?? '', MARGIN + 4, startY + 13);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8)
      .setTextColor(...MUTED);
    const address = invoice.customerSnapshot?.address ?? '';
    if (address) {
      const lines = doc.splitTextToSize(address, customerWidth - 8) as string[];
      doc.text(lines, MARGIN + 4, startY + 19);
    }

    const taxId = invoice.customerSnapshot?.taxId ?? '';
    if (taxId) {
      doc.text(`${ctx.translate('invoices.pdf.taxId')}: ${taxId}`, MARGIN + 4, startY + 30);
    }

    const rows: [string, string][] = [
      [ctx.translate('invoices.pdf.issueDate'), formatDate(invoice.issueDate, ctx.locale)],
      [ctx.translate('invoices.pdf.dueDate'), formatDate(invoice.dueDate, ctx.locale)],
      [
        ctx.translate('invoices.pdf.paymentTerms'),
        ctx.translate(`invoices.terms.${invoice.paymentTerms}`),
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
    invoice: Invoice,
    ctx: PdfContext,
    startY: number,
    money: (value: number) => string,
    qty: (value: number) => string,
    autoTable: AutoTableFn,
  ): number {
    const body = invoice.lines.map((line, index) => this.lineRow(line, index, invoice, money, qty));

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 20 },
      theme: 'grid',
      head: [
        [
          ctx.translate('invoices.pdf.colNo'),
          ctx.translate('invoices.pdf.colDescription'),
          ctx.translate('invoices.pdf.colQuantity'),
          ctx.translate('invoices.pdf.colUnitPrice'),
          ctx.translate('invoices.pdf.colDiscount'),
          ctx.translate('invoices.pdf.colNet'),
          ctx.translate('invoices.pdf.colVatRate'),
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
        0: { cellWidth: 9, halign: 'center' },
        2: { cellWidth: 18, halign: 'right' },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 18, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
        6: { cellWidth: 15, halign: 'right' },
      },
    });

    return readFinalY(doc, startY);
  }

  private lineRow(
    line: InvoiceLine,
    index: number,
    invoice: Invoice,
    money: (value: number) => string,
    qty: (value: number) => string,
  ): string[] {
    const { net } = lineTotals(line, invoice.currency);
    return [
      String(index + 1),
      line.description,
      qty(line.quantity),
      money(line.unitPrice),
      `${line.discountPct} %`,
      money(net),
      `${line.vatRate} %`,
    ];
  }

  private drawTotals(
    doc: jsPDF,
    totals: InvoiceTotals,
    ctx: PdfContext,
    startY: number,
    money: (value: number) => string,
  ): number {
    const blockWidth = 90;
    const x = PAGE_WIDTH - MARGIN - blockWidth;
    let y = startY + 8;

    const rows: TotalsRow[] = [
      { key: 'invoices.form.totals.net', value: money(totals.totalNet) },
      ...totals.vatByRate.map((group) => ({
        key: 'invoices.form.totals.vatRate',
        value: money(group.vat),
        params: { rate: group.rate },
      })),
      { key: 'invoices.form.totals.vat', value: money(totals.totalVat) },
      { key: 'invoices.form.totals.totalTtc', value: money(totals.totalTtc) },
      { key: 'invoices.form.totals.stamp', value: money(totals.stampDuty) },
      { key: 'invoices.form.totals.toPay', value: money(totals.totalToPay), strong: true },
      { key: 'invoices.form.totals.paid', value: money(totals.amountPaid) },
      { key: 'invoices.form.totals.due', value: money(totals.due), strong: true, primary: true },
    ];

    for (const row of rows) {
      doc.setFont('helvetica', row.strong ? 'bold' : 'normal');
      doc.setFontSize(row.strong ? 10 : 9);
      doc.setTextColor(...MUTED);
      doc.text(ctx.translate(row.key, row.params), x, y);
      const valueColor = row.primary ? PRIMARY : INK;
      doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
      doc.text(row.value, PAGE_WIDTH - MARGIN, y, { align: 'right' });
      y += row.strong ? 7 : 6;
    }

    return y;
  }

  private drawNotes(doc: jsPDF, invoice: Invoice, ctx: PdfContext, startY: number): void {
    if (!invoice.notes.trim()) return;

    const y = startY + 6;
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(8)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('invoices.pdf.notes').toUpperCase(), MARGIN, y);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8.5)
      .setTextColor(...INK);
    const lines = doc.splitTextToSize(invoice.notes, CONTENT_WIDTH) as string[];
    doc.text(lines, MARGIN, y + 5);
  }

  private drawFooters(doc: jsPDF, invoice: Invoice, ctx: PdfContext): void {
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(8)
        .setTextColor(...MUTED);
      doc.text(invoice.number ?? '', MARGIN, 291);
      doc.text(
        `${ctx.translate('invoices.pdf.page')} ${page} / ${pages}`,
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

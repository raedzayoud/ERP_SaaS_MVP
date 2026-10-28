import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { formatDate, formatMoney, formatNumber } from '../../../shared/utils/money';
import { SupplierBill } from '../models/supplier-bill';
import { billState, billTotals } from '../utils/supplier-bill-calc';

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

export interface SuppliersPdfContext {
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
export class SupplierBillPdfService {
  async download(bill: SupplierBill, paid: number, context: SuppliersPdfContext): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const totals = billTotals(bill.lines, bill.currency);
    const state = billState(paid, totals.totalTtc);
    const money = (value: number) => formatMoney(value, bill.currency, context.locale);

    const headerY = this.drawHeader(doc, bill, context);
    const partiesY = this.drawParties(doc, bill, state, context, headerY);
    const tableY = this.drawLines(doc, bill, context, partiesY, money, autoTable);
    const totalsY = this.drawTotals(doc, bill, totals, paid, state, context, tableY, money);
    this.drawNotes(doc, bill, context, totalsY);
    this.drawFooters(doc, bill, context);

    doc.save(`${bill.number}.pdf`);
  }

  private drawHeader(doc: jsPDF, bill: SupplierBill, ctx: SuppliersPdfContext): number {
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
      doc.text(`${ctx.translate('invoices.pdf.taxId')}: ${ctx.buyerTaxId}`, MARGIN, MARGIN + 17);
    }

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(18)
      .setTextColor(...PRIMARY);
    doc.text(ctx.translate('purchases.bills.pdf.title'), PAGE_WIDTH - MARGIN, MARGIN + 6, {
      align: 'right',
    });

    doc.setFontSize(12).setTextColor(...INK);
    doc.text(bill.number, PAGE_WIDTH - MARGIN, MARGIN + 14, { align: 'right' });

    return MARGIN + 26;
  }

  private drawParties(
    doc: jsPDF,
    bill: SupplierBill,
    state: string,
    ctx: SuppliersPdfContext,
    startY: number,
  ): number {
    const boxHeight = 34;
    const boxWidth = 100;
    const datesWidth = 76;
    const datesX = PAGE_WIDTH - MARGIN - datesWidth;

    doc.setFillColor(...SOFT_FILL).setDrawColor(...BORDER);
    doc.roundedRect(MARGIN, startY, boxWidth, boxHeight, 2, 2, 'FD');

    doc
      .setFont('helvetica', 'bold')
      .setFontSize(7)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('purchases.pdf.supplier').toUpperCase(), MARGIN + 4, startY + 6);

    doc.setFontSize(10).setTextColor(...INK);
    doc.text(bill.supplierSnapshot?.name ?? '', MARGIN + 4, startY + 13);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8)
      .setTextColor(...MUTED);
    const address = bill.supplierSnapshot?.address ?? '';
    if (address) {
      const lines = doc.splitTextToSize(address, boxWidth - 8) as string[];
      doc.text(lines, MARGIN + 4, startY + 19);
    }

    const taxId = bill.supplierSnapshot?.taxId ?? '';
    if (taxId) {
      doc.text(`${ctx.translate('invoices.pdf.taxId')}: ${taxId}`, MARGIN + 4, startY + 30);
    }

    const rows: [string, string][] = [
      [ctx.translate('purchases.bills.pdf.billingDate'), formatDate(bill.billingDate, ctx.locale)],
      [ctx.translate('purchases.bills.pdf.dueDate'), formatDate(bill.dueDate, ctx.locale)],
      [
        ctx.translate('purchases.bills.detail.state'),
        ctx.translate(`purchases.payment.${state}`),
      ],
    ];

    if (bill.orderNumber) {
      rows.push([
        ctx.translate('purchases.bills.detail.fromOrder'),
        bill.orderNumber,
      ]);
    }

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
    bill: SupplierBill,
    ctx: SuppliersPdfContext,
    startY: number,
    money: (value: number) => string,
    autoTable: AutoTableFn,
  ): number {
    const body = bill.lines.map((line, index) =>
      [
        String(index + 1),
        line.reference,
        line.description,
        line.unit,
        formatNumber(line.quantity, ctx.locale),
        money(line.unitCost),
        `${line.vatRate} %`,
        money(line.quantity * line.unitCost),
      ],
    );

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 20 },
      theme: 'grid',
      head: [
        [
          ctx.translate('purchases.bills.pdf.colNo'),
          ctx.translate('purchases.pdf.colRef'),
          ctx.translate('purchases.pdf.colDescription'),
          ctx.translate('purchases.bills.pdf.colUnit'),
          ctx.translate('purchases.pdf.colQuantity'),
          ctx.translate('purchases.bills.pdf.colUnitCost'),
          ctx.translate('purchases.pdf.colVatRate'),
          ctx.translate('purchases.pdf.colNet'),
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
        3: { cellWidth: 16 },
        4: { cellWidth: 16, halign: 'right' },
        5: { cellWidth: 22, halign: 'right' },
        6: { cellWidth: 13, halign: 'right' },
        7: { cellWidth: 24, halign: 'right' },
      },
    });

    return readFinalY(doc, startY);
  }

  private drawTotals(
    doc: jsPDF,
    bill: SupplierBill,
    totals: ReturnType<typeof billTotals>,
    paid: number,
    state: string,
    ctx: SuppliersPdfContext,
    startY: number,
    money: (value: number) => string,
  ): number {
    const blockWidth = 90;
    const x = PAGE_WIDTH - MARGIN - blockWidth;
    let y = startY + 8;

    const rows: TotalsRow[] = [
      { key: 'purchases.form.totals.net', value: money(totals.totalNet) },
      { key: 'purchases.form.totals.vat', value: money(totals.totalVat) },
      { key: 'purchases.form.totals.totalTtc', value: money(totals.totalTtc), strong: true },
      { key: 'purchases.bills.pdf.paid', value: money(paid) },
      {
        key: `purchases.payment.${state}`,
        value: money(Math.max(0, totals.totalTtc - paid)),
        strong: state !== 'paid',
      },
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

  private drawNotes(
    doc: jsPDF,
    bill: SupplierBill,
    ctx: SuppliersPdfContext,
    startY: number,
  ): void {
    if (!bill.notes.trim()) return;

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
    const lines = doc.splitTextToSize(bill.notes, CONTENT_WIDTH) as string[];
    doc.text(lines, MARGIN, y + 5);
  }

  private drawFooters(doc: jsPDF, bill: SupplierBill, ctx: SuppliersPdfContext): void {
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(8)
        .setTextColor(...MUTED);
      doc.text(bill.number, MARGIN, 291);
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

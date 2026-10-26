import { Injectable } from '@angular/core';
import type { jsPDF } from 'jspdf';
import type { UserOptions } from 'jspdf-autotable';
import { formatDate, formatNumber } from '../../../shared/utils/money';
import { DeliveryNote } from '../models/delivery-note';

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

interface AutoTableHolder {
  lastAutoTable?: { finalY?: number };
}

/** PDF export context (same fields as the purchase order PDF). */
export interface DeliveryPdfContext {
  buyerName: string;
  buyerAddress: string;
  buyerTaxId: string;
  locale: string;
  translate: TranslateFn;
}

@Injectable({ providedIn: 'root' })
export class DeliveryPdfService {
  async download(note: DeliveryNote, context: DeliveryPdfContext): Promise<void> {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });

    const headerY = this.drawHeader(doc, note, context);
    const partiesY = this.drawParties(doc, note, context, headerY);
    const tableY = this.drawLines(doc, note, context, partiesY, autoTable);
    this.drawNotes(doc, note, context, tableY);
    this.drawFooters(doc, note, context);

    doc.save(`${note.deliveryNumber}.pdf`);
  }

  private drawHeader(doc: jsPDF, note: DeliveryNote, ctx: DeliveryPdfContext): number {
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
    doc.text(ctx.translate('deliveries.pdf.title'), PAGE_WIDTH - MARGIN, MARGIN + 6, {
      align: 'right',
    });

    doc.setFontSize(12).setTextColor(...INK);
    doc.text(note.deliveryNumber, PAGE_WIDTH - MARGIN, MARGIN + 14, { align: 'right' });

    return MARGIN + 26;
  }

  private drawParties(
    doc: jsPDF,
    note: DeliveryNote,
    ctx: DeliveryPdfContext,
    startY: number,
  ): number {
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
    doc.text(ctx.translate('deliveries.pdf.customer').toUpperCase(), MARGIN + 4, startY + 6);

    doc.setFontSize(10).setTextColor(...INK);
    doc.text(note.customer?.name ?? '', MARGIN + 4, startY + 13);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8)
      .setTextColor(...MUTED);
    const address = note.customer?.address ?? '';
    if (address) {
      const lines = doc.splitTextToSize(address, customerWidth - 8) as string[];
      doc.text(lines, MARGIN + 4, startY + 19);
    }

    const taxId = note.customer?.taxId ?? '';
    if (taxId) {
      doc.text(`${ctx.translate('purchases.pdf.taxId')}: ${taxId}`, MARGIN + 4, startY + 30);
    }

    const rows: [string, string][] = [
      [
        ctx.translate('deliveries.pdf.deliveryDate'),
        formatDate(note.deliveryDate, ctx.locale),
      ],
      [
        ctx.translate('deliveries.pdf.orderRef'),
        note.salesOrderNumber ?? ctx.translate('deliveries.detail.noNumber'),
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
    note: DeliveryNote,
    ctx: DeliveryPdfContext,
    startY: number,
    autoTable: AutoTableFn,
  ): number {
    const body = note.lines.map((line, index) => [
      String(index + 1),
      line.reference,
      line.description,
      `${line.unit}`,
      formatNumber(line.quantity, ctx.locale),
    ]);

    autoTable(doc, {
      startY,
      margin: { left: MARGIN, right: MARGIN, top: MARGIN, bottom: 20 },
      theme: 'grid',
      head: [
        [
          ctx.translate('deliveries.pdf.colNo'),
          ctx.translate('deliveries.pdf.colRef'),
          ctx.translate('deliveries.pdf.colDescription'),
          ctx.translate('deliveries.pdf.colUnit'),
          ctx.translate('deliveries.pdf.colQuantity'),
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
        1: { cellWidth: 22 },
        4: { cellWidth: 18, halign: 'right' },
      },
    });

    const holder = doc as unknown as AutoTableHolder;
    return holder.lastAutoTable?.finalY ?? startY;
  }

  private drawNotes(
    doc: jsPDF,
    note: DeliveryNote,
    ctx: DeliveryPdfContext,
    startY: number,
  ): void {
    if (!note.notes?.trim()) return;

    const y = startY + 6;
    doc
      .setFont('helvetica', 'bold')
      .setFontSize(8)
      .setTextColor(...MUTED);
    doc.text(ctx.translate('deliveries.pdf.notes').toUpperCase(), MARGIN, y);

    doc
      .setFont('helvetica', 'normal')
      .setFontSize(8.5)
      .setTextColor(...INK);
    const lines = doc.splitTextToSize(note.notes, CONTENT_WIDTH) as string[];
    doc.text(lines, MARGIN, y + 5);
  }

  private drawFooters(doc: jsPDF, note: DeliveryNote, ctx: DeliveryPdfContext): void {
    const pages = doc.getNumberOfPages();

    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc
        .setFont('helvetica', 'normal')
        .setFontSize(8)
        .setTextColor(...MUTED);
      doc.text(note.deliveryNumber, MARGIN, 291);
      doc.text(
        `${ctx.translate('purchases.pdf.page')} ${page} / ${pages}`,
        PAGE_WIDTH - MARGIN,
        291,
        { align: 'right' },
      );
    }
  }
}

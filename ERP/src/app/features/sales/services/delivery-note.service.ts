import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, switchMap, throwError, timer } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { todayIso } from '../../../shared/utils/money';
import { MAIN_WAREHOUSE_ID } from '../../stock/models/warehouse';
import { StockError, StockService } from '../../stock/services/stock.service';
import { dueDateFrom } from '../../invoices/utils/invoice-calc';
import { Invoice, InvoiceDraftInput } from '../../invoices/models/invoice';
import { InvoiceService } from '../../invoices/services/invoice.service';
import { InvoicingSettingsService } from '../../invoicing/services/invoicing-settings.service';
import { CustomerSnapshot, SalesOrder } from '../models/sales-order';
import {
  DELIVERY_NUMBER_PREFIX,
  DeliveryError,
  DeliveryInput,
  DeliveryNote,
  DeliveryQuery,
  deliveryNumber,
} from '../models/delivery-note';
import { SalesOrderService } from './sales-order.service';

const LATENCY_MS = 300;

const LAPTOP = 'a1000000-0000-4000-8000-000000000001';

/** Delivered seed from a previous year (example row for the demo workspace). */
const SEED_DELIVERIES: DeliveryNote[] = [
  {
    id: 'f6000000-0000-4000-8000-000000000001',
    deliveryNumber: 'BL-2026-0001',
    salesOrderId: 'e5000000-0000-4000-8000-000000000009',
    salesOrderNumber: 'CMD-2025-0117',
    customer: {
      name: 'Atlas Consulting',
      taxId: '11223344/A/M/000',
      address: '98 Rue de Marseille, Marseille, FR',
    },
    deliveryDate: '2026-10-20',
    warehouseId: MAIN_WAREHOUSE_ID,
    lines: [
      {
        productId: LAPTOP,
        reference: 'SKU-1001',
        description: 'Laptop Pro 14',
        unit: 'piece',
        quantity: 4,
      },
    ],
    notes: 'Delivered to the reception desk.',
    status: 'issued',
    createdAt: '2026-10-20T09:00:00.000Z',
  },
];

/**
 * Mock service for delivery notes (bons de livraison).
 * One order can be fully delivered once. Creating the delivery note
 * posts a "sale: out" stock movement through StockService.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryNoteService {
  private readonly items = signal<DeliveryNote[]>(SEED_DELIVERIES);
  private readonly orders = inject(SalesOrderService);
  private readonly stock = inject(StockService);
  private readonly invoices = inject(InvoiceService);
  private readonly settings = inject(InvoicingSettingsService);

  getDeliveries(query: DeliveryQuery): Observable<Page<DeliveryNote>> {
    return timer(LATENCY_MS).pipe(map(() => this.buildPage(query)));
  }

  getDelivery(id: string): Observable<DeliveryNote | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => this.items().find((note) => note.id === id)),
    );
  }

  getDeliveryByOrder(salesOrderId: string): Observable<DeliveryNote | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() =>
        this.items().find(
          (note) =>
            note.salesOrderId === salesOrderId || note.salesOrderNumber === salesOrderId,
        ),
      ),
    );
  }

  /** Creates and saves a draft invoice pre-filled from this delivery note. */
  createInvoiceDraft(deliveryId: string): Observable<Invoice> {
    return this.getDelivery(deliveryId).pipe(
      switchMap((delivery) => {
        if (!delivery) return throwError(() => new DeliveryError('notFound'));

        return this.invoices.getInvoiceForDelivery(delivery.id).pipe(
          switchMap((linked) => {
            if (linked) return throwError(() => new DeliveryError('alreadyInvoiced'));

            return this.orders.getOrder(delivery.salesOrderId).pipe(
              switchMap((order) => {
                if (!order) return throwError(() => new DeliveryError('originMissing'));

                return this.invoices.saveDraft(this.draftInput(delivery, order)).pipe(
                map((invoice) => {
                  this.orders.linkInvoice(order.id, invoice.id);
                  return invoice;
                }),
              );
              }),
            );
          }),
        );
      }),
    );
  }

  /**
   * Delivered quantities and prices frozen from the sales order, never the
   * current catalogue: price, discount and VAT come from the order lines.
   */
  private draftInput(delivery: DeliveryNote, order: SalesOrder): InvoiceDraftInput {
    const priceByProduct = new Map(
      order.lines
        .filter((line) => line.productId)
        .map((line) => [line.productId as string, line]),
    );
    const settings = this.settings.settings();

    return {
      id: null,
      kind: 'invoice',
      customerId: order.customerId,
      issueDate: todayIso(),
      dueDate: dueDateFrom(todayIso(), order.paymentTerms),
      paymentTerms: order.paymentTerms,
      currency: order.currency,
      stampDuty: settings.defaultStampDuty,
      notes: '',
      originInvoiceId: null,
      salesOrderId: order.id,
      deliveryNoteId: delivery.id,
      lines: delivery.lines.map((line) => {
        const orderLine = line.productId ? priceByProduct.get(line.productId) : undefined;

        return {
          productId: line.productId || null,
          description: orderLine?.description ?? line.reference,
          quantity: line.quantity,
          unitPrice: orderLine?.unitPrice ?? 0,
          discountPct: orderLine?.discountPct ?? 0,
          vatRate: orderLine?.vatRate ?? settings.defaultVatRate,
        };
      }),
    };
  }

  /** Full delivery of one confirmed sales order. */
  create(input: DeliveryInput): Observable<DeliveryNote> {
    return this.orders.getOrder(input.salesOrderId).pipe(
      switchMap((order) => {
        if (!order) throw new DeliveryError('orderNotFound');
        if (order.status !== 'confirmed') throw new DeliveryError('orderNotConfirmed');
        if (this.items().some((note) => note.salesOrderId === order.id)) {
          throw new DeliveryError('alreadyDelivered');
        }

        const stockId = this.newId();
        const deliverableLines = order.lines.filter(
          (line): line is typeof line & { productId: string } => !!line.productId,
        );

        if (deliverableLines.length === 0) throw new DeliveryError('orderNotConfirmed');

        return this.stock
          .recordSalePosting({
            refId: stockId,
            date: input.deliveryDate,
            warehouseId: input.warehouseId,
            items: deliverableLines.map((line) => ({
              productId: line.productId,
              quantity: line.quantity,
            })),
          })
          .pipe(
            map(() => {
              const note = this.store(order, input, stockId);
              this.orders.linkDelivery(order.id, note.id);
              return note;
            }),
            catchError((error: unknown) =>
              throwError(() =>
                error instanceof StockError && error.code === 'insufficientStock'
                  ? new DeliveryError('insufficientStock')
                  : error,
              ),
            ),
          );
      }),
    );
  }

  private store(order: SalesOrder, input: DeliveryInput, id: string): DeliveryNote {
    const now = new Date().toISOString();
    const note: DeliveryNote = {
      id,
      deliveryNumber: this.nextNumber(input.deliveryDate),
      salesOrderId: order.id,
      salesOrderNumber: order.number,
      customer: order.customerSnapshot ?? { name: '', taxId: '', address: '' },
      deliveryDate: input.deliveryDate,
      warehouseId: input.warehouseId || MAIN_WAREHOUSE_ID,
      lines: order.lines.map((line) => ({
        productId: line.productId ?? '',
        reference: line.reference,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
      })),
      notes: input.notes ?? '',
      status: 'issued',
      createdAt: now,
    };

    this.items.update((list) => [...list, note]);
    return note;
  }

  private nextNumber(deliveryDate: string): string {
    const year = deliveryDate.slice(0, 4);
    let sequence = 0;

    for (const note of this.items()) {
      const [prefixPart, yearPart, sequencePart] = note.deliveryNumber.split('-');
      if (prefixPart !== DELIVERY_NUMBER_PREFIX || yearPart !== year) continue;
      const value = Number(sequencePart);
      if (Number.isFinite(value) && value > sequence) sequence = value;
    }

    return deliveryNumber(Number(year), sequence + 1);
  }

  private buildPage(query: DeliveryQuery): Page<DeliveryNote> {
    const search = query.search?.trim().toLowerCase();

    const filtered = this.items().filter((note) => {
      if (search && !this.matchesSearch(note, search)) return false;
      if (query.from && note.deliveryDate < query.from) return false;
      if (query.to && note.deliveryDate > query.to) return false;
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const [field, direction] = (query.sort ?? 'deliveryDate,desc').split(',');
      const sign = direction === 'desc' ? -1 : 1;
      const valueA = field === 'deliveryNumber' ? a.deliveryNumber : a.deliveryDate;
      const valueB = field === 'deliveryNumber' ? b.deliveryNumber : b.deliveryDate;
      return valueA.localeCompare(valueB) * sign;
    });

    const size = 50;

    return {
      items: sorted,
      total: sorted.length,
      page: 0,
      size,
    };
  }

  private matchesSearch(note: DeliveryNote, search: string): boolean {
    const haystack = [
      note.deliveryNumber,
      note.salesOrderNumber ?? '',
      note.customer?.name ?? '',
    ];
    return haystack.some((value) => value.toLowerCase().includes(search));
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

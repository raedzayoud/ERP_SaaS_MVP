import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TenantService } from '../../../../core/services/tenant.service';
import { MAIN_WAREHOUSE_ID, Warehouse } from '../../../stock/models/warehouse';
import { StockService } from '../../../stock/services/stock.service';
import { Invoice, PaymentState } from '../../../invoices/models/invoice';
import { paymentState } from '../../../invoices/utils/invoice-calc';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { SalesOrder } from '../../models/sales-order';
import { DeliveryNote } from '../../models/delivery-note';
import { DeliveryPdfService, DeliveryPdfContext } from '../../services/delivery-pdf.service';
import { DeliveryNoteService } from '../../services/delivery-note.service';
import { SalesOrderService } from '../../services/sales-order.service';

@Component({
  selector: 'app-delivery-detail',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TranslocoDirective],
  templateUrl: './delivery-detail.html',
  styleUrl: './delivery-detail.css',
})
export class DeliveryDetail {
  private readonly service = inject(DeliveryNoteService);
  private readonly stock = inject(StockService);
  private readonly pdfService = inject(DeliveryPdfService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly invoices = inject(InvoiceService);
  private readonly orders = inject(SalesOrderService);

  readonly noteId: string | null = this.route.snapshot.paramMap.get('id');

  note = signal<DeliveryNote | null>(null);
  warehouses = signal<Warehouse[]>([]);
  order = signal<SalesOrder | null>(null);
  linkedInvoice = signal<Invoice | null>(null);
  loading = signal(true);
  loadFailed = signal(false);
  pdfBusy = signal(false);
  pdfError = signal(false);
  invoiceBusy = signal(false);
  invoiceFailed = signal(false);

  readonly buyerName = computed(() => this.tenantService.currentTenant()?.companyName ?? '');

  readonly buyerAddress = computed(() => this.tenantService.currentTenant()?.address ?? '');

  readonly buyerTaxId = computed(() => this.tenantService.currentTenant()?.taxId ?? '');

  constructor() {
    this.loadWarehouses();
    this.load();
  }

  loadWarehouses(): void {
    this.stock
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((warehouses) => this.warehouses.set(warehouses));
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.service
      .getDelivery(this.noteId ?? '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note) => {
          this.note.set(note ?? null);
          this.loading.set(false);
          this.loadOrder();
          this.loadLinkedInvoice();
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  loadOrder(): void {
    const note = this.note();
    if (!note) return;

    this.orders
      .getOrder(note.salesOrderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((order) => this.order.set(order ?? null));
  }

  loadLinkedInvoice(): void {
    const note = this.note();
    if (!note) return;

    this.invoices
      .getInvoiceForDelivery(note.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((invoice) => this.linkedInvoice.set(invoice));
  }

  createInvoice(): void {
    const note = this.note();
    if (!note || this.invoiceBusy() || !this.order()) return;

    this.invoiceBusy.set(true);
    this.invoiceFailed.set(false);

    this.service
      .createInvoiceDraft(note.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.invoiceBusy.set(false);
          this.router.navigate(['/invoices', draft.id]);
        },
        error: () => {
          this.invoiceBusy.set(false);
          this.invoiceFailed.set(true);
        },
      });
  }

  invoiceStatusKey(): 'chain.invoiceDraft' | 'chain.invoiced' {
    const invoice = this.linkedInvoice();
    return invoice?.status === 'draft' ? 'chain.invoiceDraft' : 'chain.invoiced';
  }

  invoicePayment(): PaymentState {
    const invoice = this.linkedInvoice();
    return invoice ? paymentState(invoice) : 'none';
  }

  warehouseLabel(warehouseId: string): string {
    const warehouse = this.warehouses().find((w) => w.id === warehouseId);
    return warehouse ? `${warehouse.code} — ${warehouse.name}` : warehouseId;
  }

  isMainWarehouse(warehouseId: string): boolean {
    return warehouseId === MAIN_WAREHOUSE_ID;
  }

  totalQuantity(): number {
    return this.note()?.lines.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  }

  async downloadPdf(): Promise<void> {
    const current = this.note();
    if (!current) return;

    this.pdfBusy.set(true);
    this.pdfError.set(false);

    const tenant = this.tenantService.currentTenant();
    const context: DeliveryPdfContext = {
      buyerName: tenant?.companyName ?? '',
      buyerAddress: tenant?.address ?? '',
      buyerTaxId: tenant?.taxId ?? '',
      locale: this.transloco.getActiveLang(),
      translate: (key, params) => this.transloco.translate(key, params),
    };

    try {
      await this.pdfService.download(current, context);
    } catch {
      this.pdfError.set(true);
    } finally {
      this.pdfBusy.set(false);
    }
  }
}

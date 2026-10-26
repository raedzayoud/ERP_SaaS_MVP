import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TenantService } from '../../../../core/services/tenant.service';
import { PurchaseOrder, ReceptionState } from '../../models/purchase-order';
import { PurchasePdfService, PdfContext } from '../../services/purchase-pdf.service';
import { PurchaseError, PurchaseService } from '../../services/purchase.service';
import {
  PurchaseTotals,
  isCancellable,
  isEditable,
  isLate,
  isReceivable,
  lineNet,
  purchaseTotals,
  receptionState,
} from '../../utils/purchase-calc';
import { ReceptionBadge } from '../../components/reception-badge/reception-badge';

@Component({
  selector: 'app-purchase-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective, StatusBadge, ReceptionBadge],
  templateUrl: './purchase-detail.html',
  styleUrl: './purchase-detail.css',
})
export class PurchaseDetail {
  private readonly service = inject(PurchaseService);
  private readonly pdfService = inject(PurchasePdfService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly order = signal<PurchaseOrder | null>(null);
  readonly totals = signal<PurchaseTotals | null>(null);
  readonly reception = signal<ReceptionState>('none');
  readonly late = signal(false);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly pdfBusy = signal(false);
  readonly notice = signal('');
  readonly errorKey = signal<string | null>(null);

  readonly buyerName = computed(() => this.tenantService.currentTenant()?.companyName ?? '');
  readonly buyerAddress = computed(() => this.tenantService.currentTenant()?.address ?? '');
  readonly buyerTaxId = computed(() => this.tenantService.currentTenant()?.taxId ?? '');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.orderId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.service
      .getOrder(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          if (!order) {
            this.loadFailed.set(true);
            this.loading.set(false);
            return;
          }
          this.applyOrder(order);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  confirm(): void {
    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .confirmOrder(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmed) => {
          this.saving.set(false);
          this.applyOrder(confirmed);
          this.showNotice('purchases.confirmed');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  cancel(): void {
    const confirmed = window.confirm(this.transloco.translate('purchases.detail.confirmCancel'));
    if (!confirmed) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .cancelOrder(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (cancelled) => {
          this.saving.set(false);
          this.applyOrder(cancelled);
          this.showNotice('purchases.cancelled');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  remove(): void {
    const confirmed = window.confirm(this.transloco.translate('purchases.detail.confirmDelete'));
    if (!confirmed) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .deleteDraft(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/purchases']);
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  async downloadPdf(): Promise<void> {
    const current = this.order();
    if (!current) return;

    this.pdfBusy.set(true);
    this.errorKey.set(null);

    const tenant = this.tenantService.currentTenant();
    const context: PdfContext = {
      buyerName: tenant?.companyName ?? '',
      buyerAddress: tenant?.address ?? '',
      buyerTaxId: tenant?.taxId ?? '',
      locale: this.transloco.getActiveLang(),
      translate: (key, params) => this.transloco.translate(key, params),
    };

    try {
      await this.pdfService.download(current, context);
    } catch {
      this.errorKey.set('purchases.detail.pdfError');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  canConfirm(): boolean {
    const order = this.order();
    return !!order && order.status === 'draft' && order.lines.length > 0;
  }

  canReceive(): boolean {
    const order = this.order();
    return !!order && isReceivable(order);
  }

  canCancel(): boolean {
    const order = this.order();
    return !!order && isCancellable(order);
  }

  canDelete(): boolean {
    const order = this.order();
    return !!order && isEditable(order);
  }

  canDownloadPdf(): boolean {
    const order = this.order();
    return !!order && order.status === 'confirmed';
  }

  lineNetOf(order: PurchaseOrder, line: PurchaseOrder['lines'][number]): number {
    return lineNet(line, order.currency);
  }

  lateOf(order: PurchaseOrder): boolean {
    return isLate(order);
  }

  unitOf(order: PurchaseOrder, lineId: string): string | null {
    return order.lines.find((line) => line.id === lineId)?.unit ?? null;
  }

  private applyOrder(order: PurchaseOrder): void {
    this.order.set(order);
    this.totals.set(purchaseTotals(order.lines, order.currency));
    this.reception.set(receptionState(order.lines));
    this.late.set(isLate(order));
  }

  private showActionError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof PurchaseError
        ? `purchases.errors.${error.code}`
        : 'purchases.detail.actionError',
    );
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}

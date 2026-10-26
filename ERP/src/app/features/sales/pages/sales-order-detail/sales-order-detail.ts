import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TenantService } from '../../../../core/services/tenant.service';
import { SalesOrder } from '../../models/sales-order';
import { SalesError, SalesOrderService } from '../../services/sales-order.service';
import { SalesTotals, isCancellable, isInvoiceable, isLate, lineNet, salesTotals } from '../../utils/sales-calc';

@Component({
  selector: 'app-sales-order-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective, StatusBadge],
  templateUrl: './sales-order-detail.html',
  styleUrl: './sales-order-detail.css',
})
export class SalesOrderDetail {
  private readonly service = inject(SalesOrderService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly order = signal<SalesOrder | null>(null);
  readonly totals = signal<SalesTotals | null>(null);
  readonly late = signal(false);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly notice = signal('');
  readonly errorKey = signal<string | null>(null);

  readonly companyName = computed(() => this.tenantService.currentTenant()?.companyName ?? '');
  readonly companyAddress = computed(() => this.tenantService.currentTenant()?.address ?? '');
  readonly companyTaxId = computed(() => this.tenantService.currentTenant()?.taxId ?? '');

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
          this.showNotice('sales.confirmed');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  cancel(): void {
    const confirmed = window.confirm(this.transloco.translate('sales.detail.confirmCancel'));
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
          this.showNotice('sales.cancelled');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  remove(): void {
    const confirmed = window.confirm(this.transloco.translate('sales.detail.confirmDelete'));
    if (!confirmed) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .deleteDraft(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/sales-orders']);
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  createInvoice(): void {
    const current = this.order();
    if (!current) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .createInvoice(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invoice) => {
          this.saving.set(false);
          this.applyOrder({
            ...current,
            invoiceId: invoice.id,
            updatedAt: new Date().toISOString(),
          });
          this.showNotice('sales.invoiceCreated');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  canConfirm(): boolean {
    const order = this.order();
    return !!order && order.status === 'draft' && order.lines.length > 0;
  }

  canInvoice(): boolean {
    const order = this.order();
    return !!order && isInvoiceable(order);
  }

  canCancel(): boolean {
    const order = this.order();
    return !!order && isCancellable(order);
  }

  canDelete(): boolean {
    const order = this.order();
    return !!order && order.status === 'draft';
  }

  lineNetOf(order: SalesOrder, line: SalesOrder['lines'][number]): number {
    return lineNet(line, order.currency);
  }

  lateOf(order: SalesOrder): boolean {
    return isLate(order);
  }

  private applyOrder(order: SalesOrder): void {
    this.order.set(order);
    this.totals.set(salesTotals(order.lines, order.currency));
    this.late.set(isLate(order));
  }

  private showActionError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof SalesError ? `sales.errors.${error.code}` : 'sales.detail.actionError',
    );
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}

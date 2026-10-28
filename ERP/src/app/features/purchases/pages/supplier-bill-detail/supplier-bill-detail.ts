import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { TenantService } from '../../../../core/services/tenant.service';
import { Payment, PaymentMode, PAYMENT_MODES } from '../../../payments/models/payment';
import { PaymentService } from '../../../payments/services/payment.service';
import { SupplierBill } from '../../models/supplier-bill';
import { SupplierBillError, SupplierBillService } from '../../services/supplier-bill.service';
import { PermissionService } from '../../../../core/services/permission.service';
import {
  SupplierBillPdfService,
  SuppliersPdfContext,
} from '../../services/supplier-bill-pdf.service';
import { todayIso } from '../../../../shared/utils/money';

@Component({
  selector: 'app-supplier-bill-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, ReactiveFormsModule, TranslocoDirective],
  templateUrl: './supplier-bill-detail.html',
  styleUrl: './supplier-bill-detail.css',
})
export class SupplierBillDetail {
  readonly service = inject(SupplierBillService);
  private readonly paymentsService = inject(PaymentService);
  private readonly pdfService = inject(SupplierBillPdfService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  readonly modes = PAYMENT_MODES;

  readonly billId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly bill = signal<SupplierBill | null>(null);
  readonly payments = signal<Payment[]>([]);
  readonly paid = signal(0);
  readonly balance = signal(0);
  readonly state = signal<'unpaid' | 'partial' | 'paid'>('unpaid');
  readonly overdue = signal(false);
  readonly currency = signal('USD');
  readonly totals = signal({ totalNet: 0, totalVat: 0, totalTtc: 0 });

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly pdfBusy = signal(false);
  readonly notice = signal('');
  readonly errorKey = signal<string | null>(null);

  readonly buyerName = computed(() => this.tenantService.currentTenant()?.companyName ?? '');

  readonly payForm = this.fb.nonNullable.group({
    date: [todayIso(), Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    mode: ['transfer' as PaymentMode, Validators.required],
    reference: [''],
    notes: [''],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.billId) {
      this.failLoading();
      return;
    }

    this.service
      .getBill(this.billId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (bill) => {
          if (!bill) {
            this.loadFailed.set(true);
            this.loading.set(false);
            return;
          }
          this.applyBill(bill);
          this.loading.set(false);
        },
        error: () => this.failLoading(),
      });
  }

  pay(): void {
    this.errorKey.set(null);

    if (this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      this.errorKey.set('payments.form.checkErrors');
      return;
    }

    const raw = this.payForm.getRawValue();
    this.saving.set(true);

    this.service
      .addPayment(this.billId, {
        invoiceId: this.billId,
        date: raw.date,
        amount: Number(raw.amount),
        mode: raw.mode,
        reference: raw.reference,
        notes: raw.notes,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.payForm.controls.amount.setValue(0);
          this.payForm.controls.reference.setValue('');
          this.showNotice('purchases.bills.detail.paid');
          this.load();
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorKey.set(
            error instanceof SupplierBillError
              ? `purchases.bills.errors.${error.code}`
              : 'purchases.bills.detail.actionError',
          );
        },
      });
  }

  remove(): void {
    const confirmed = window.confirm(
      this.transloco.translate('purchases.bills.detail.confirmDelete'),
    );
    if (!confirmed) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .deleteBill(this.billId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/supplier-bills']),
        error: (error: unknown) => {
          this.saving.set(false);
          this.errorKey.set(
            error instanceof SupplierBillError
              ? `purchases.bills.errors.${error.code}`
              : 'purchases.bills.detail.actionError',
          );
        },
      });
  }

  async downloadPdf(): Promise<void> {
    const bill = this.bill();
    if (!bill) return;

    this.pdfBusy.set(true);
    this.errorKey.set(null);

    const tenant = this.tenantService.currentTenant();
    const context: SuppliersPdfContext = {
      buyerName: tenant?.companyName ?? '',
      buyerAddress: tenant?.address ?? '',
      buyerTaxId: tenant?.taxId ?? '',
      locale: this.transloco.getActiveLang(),
      translate: (key, params) => this.transloco.translate(key, params),
    };

    try {
      await this.pdfService.download(bill, this.paid(), context);
    } catch {
      this.errorKey.set('purchases.bills.detail.pdfError');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  canPay(): boolean {
    return !!this.bill() && this.state() !== 'paid';
  }

  canRemove(): boolean {
    return !!this.bill() && this.paid() === 0;
  }

  private applyBill(bill: SupplierBill): void {
    this.bill.set(bill);
    this.currency.set(bill.currency);
    this.totals.set(this.service.totalOf(bill));
    this.paid.set(this.service.paidOf(bill));
    this.balance.set(this.service.outstandingOf(bill));
    this.state.set(this.service.stateOf(bill));
    this.overdue.set(this.service.overdue(bill));
    this.payForm.controls.amount.setValue(this.round(this.service.outstandingOf(bill)));

    this.paymentsService
      .getPaymentsByDoc(bill.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => this.payments.set(rows));
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private failLoading(): void {
    this.loadFailed.set(true);
    this.loading.set(false);
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}

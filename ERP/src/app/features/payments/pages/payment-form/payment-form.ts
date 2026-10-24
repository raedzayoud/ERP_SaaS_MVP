import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { todayIso } from '../../../../shared/utils/money';
import { Invoice } from '../../../invoices/models/invoice';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { invoiceTotals, paymentState } from '../../../invoices/utils/invoice-calc';
import { PAYMENT_MODES, PaymentMode } from '../../models/payment';
import { PaymentError, PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-payment-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './payment-form.html',
  styleUrl: './payment-form.css',
})
export class PaymentForm {
  private readonly service = inject(PaymentService);
  private readonly invoicesService = inject(InvoiceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly modes = PAYMENT_MODES;

  invoices = signal<Invoice[]>([]);
  selectedInvoice = signal<Invoice | null>(null);
  loading = signal(true);
  loadFailed = signal(false);
  saving = signal(false);
  submitted = signal(false);
  errorKey = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    invoiceId: ['', Validators.required],
    date: [todayIso(), Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    mode: ['transfer' as PaymentMode, Validators.required],
    reference: [''],
    notes: [''],
  });

  readonly due = computed(() => {
    const invoice = this.selectedInvoice();
    return invoice ? invoiceTotals(invoice).due : 0;
  });

  constructor() {
    this.loadInvoices();
  }

  isInvalid(name: 'invoiceId' | 'date' | 'amount'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  onInvoiceChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    const invoice = this.invoices().find((item) => item.id === id) ?? null;
    this.selectedInvoice.set(invoice);

    if (invoice) {
      this.form.controls.amount.setValue(invoiceTotals(invoice).due);
    }
  }

  save(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('payments.form.checkErrors');
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    this.service
      .createPayment({
        invoiceId: raw.invoiceId,
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
          this.router.navigate(['/payments']);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  loadInvoices(): void {
    const presetId = this.route.snapshot.queryParamMap.get('invoiceId') ?? '';

    this.invoicesService
      .getInvoices({ page: 0, size: 500, status: 'posted', sort: 'issueDate,desc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          const open = page.items.filter(
            (invoice) => invoice.kind === 'invoice' && paymentState(invoice) !== 'paid',
          );
          this.invoices.set(open);
          this.loading.set(false);

          if (presetId) {
            const preset = open.find((invoice) => invoice.id === presetId);
            if (preset) {
              this.form.controls.invoiceId.setValue(preset.id);
              this.selectedInvoice.set(preset);
              this.form.controls.amount.setValue(invoiceTotals(preset).due);
            }
          }
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof PaymentError ? `payments.errors.${error.code}` : 'payments.form.saveError',
    );
  }
}

import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { lineTotals } from '../../../../shared/utils/money';
import { TenantService } from '../../../../core/services/tenant.service';
import { StatusBadge } from '../../../../shared/components/status-badge/status-badge';
import { Invoice, PaymentState } from '../../models/invoice';
import { InvoicePdfService, PdfContext } from '../../services/invoice-pdf.service';
import { InvoiceError, InvoiceService } from '../../services/invoice.service';
import { InvoiceTotals, invoiceTotals, isOverdue, paymentState } from '../../utils/invoice-calc';

@Component({
  selector: 'app-invoice-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective, StatusBadge],
  templateUrl: './invoice-detail.html',
  styleUrl: './invoice-detail.css',
})
export class InvoiceDetail {
  private readonly service = inject(InvoiceService);
  private readonly pdfService = inject(InvoicePdfService);
  private readonly tenantService = inject(TenantService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoiceId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly invoice = signal<Invoice | null>(null);
  readonly creditNotes = signal<Invoice[]>([]);
  readonly totals = signal<InvoiceTotals | null>(null);
  readonly payment = signal<PaymentState>('none');
  readonly overdue = signal(false);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly pdfBusy = signal(false);
  readonly notice = signal('');
  readonly errorKey = signal<string | null>(null);

  readonly sellerName = computed(() => this.tenantService.currentTenant()?.companyName ?? '');
  readonly sellerAddress = computed(() => this.tenantService.currentTenant()?.address ?? '');
  readonly sellerTaxId = computed(() => this.tenantService.currentTenant()?.taxId ?? '');

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.invoiceId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    forkJoin({
      invoice: this.service.getInvoice(this.invoiceId),
      creditNotes: this.service.getCreditNotesFor(this.invoiceId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ invoice, creditNotes }) => {
          if (!invoice) {
            this.loadFailed.set(true);
            this.loading.set(false);
            return;
          }
          this.applyInvoice(invoice);
          this.creditNotes.set(creditNotes);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  validate(): void {
    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .postInvoice(this.invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posted) => {
          this.saving.set(false);
          this.applyInvoice(posted);
          this.showNotice('invoices.posted');
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  remove(): void {
    const confirmed = window.confirm(this.transloco.translate('invoices.detail.confirmDelete'));
    if (!confirmed) return;

    this.saving.set(true);
    this.errorKey.set(null);

    this.service
      .deleteDraft(this.invoiceId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/invoices']);
        },
        error: (error: unknown) => this.showActionError(error),
      });
  }

  async downloadPdf(): Promise<void> {
    const current = this.invoice();
    if (!current) return;

    this.pdfBusy.set(true);
    this.errorKey.set(null);

    const tenant = this.tenantService.currentTenant();
    const context: PdfContext = {
      sellerName: tenant?.companyName ?? '',
      sellerAddress: tenant?.address ?? '',
      sellerTaxId: tenant?.taxId ?? '',
      locale: this.transloco.getActiveLang(),
      translate: (key, params) => this.transloco.translate(key, params),
    };

    try {
      await this.pdfService.download(current, context);
    } catch {
      this.errorKey.set('invoices.detail.pdfError');
    } finally {
      this.pdfBusy.set(false);
    }
  }

  createCreditNote(): void {
    this.router.navigate(['/invoices/new'], {
      queryParams: { creditNoteOf: this.invoiceId },
    });
  }

  lineNet(invoice: Invoice, line: Invoice['lines'][number]): number {
    return lineTotals(line, invoice.currency).net;
  }

  private applyInvoice(invoice: Invoice): void {
    this.invoice.set(invoice);
    this.totals.set(invoiceTotals(invoice));
    this.payment.set(paymentState(invoice));
    this.overdue.set(isOverdue(invoice));
  }

  private showActionError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof InvoiceError
        ? `invoices.errors.${error.code}`
        : 'invoices.detail.actionError',
    );
  }

  private showNotice(key: string): void {
    this.notice.set(key);
    setTimeout(() => this.notice.set(''), 3000);
  }
}

import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { PAYMENT_TERMS, PaymentTerms } from '../../../../shared/models/payment-terms';
import { lineTotals, todayIso } from '../../../../shared/utils/money';
import { Partner } from '../../../crm/models/partner';
import { PartnerService } from '../../../crm/services/partner.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { InvoicingSettingsService } from '../../../invoicing/services/invoicing-settings.service';
import { PRODUCT_VAT_RATES, Product } from '../../../products/models/product';
import { ProductService } from '../../../products/services/product.service';
import { ComboPicker, PickerItem } from '../../components/combo-picker/combo-picker';
import { Invoice, InvoiceDraftInput, InvoiceKind, InvoiceLineInput } from '../../models/invoice';
import { InvoiceError, InvoiceService } from '../../services/invoice.service';
import {
  InvoiceTotals,
  dueDateFrom,
  invoiceTotals,
  isIssueDateChronological,
} from '../../utils/invoice-calc';

interface LineFields {
  productId: FormControl<string | null>;
  description: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  discountPct: FormControl<number>;
  vatRate: FormControl<number>;
}

type LineGroup = FormGroup<LineFields>;
type HeaderControl = 'customerId' | 'issueDate' | 'paymentTerms' | 'dueDate' | 'stampDuty';

function positiveNumber(control: AbstractControl): ValidationErrors | null {
  return Number(control.value) > 0 ? null : { positive: true };
}

@Component({
  selector: 'app-invoice-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective, ComboPicker],
  templateUrl: './invoice-form.html',
  styleUrl: './invoice-form.css',
})
export class InvoiceForm {
  private readonly service = inject(InvoiceService);
  private readonly partners = inject(PartnerService);
  private readonly productsService = inject(ProductService);
  private readonly tenantService = inject(TenantService);
  private readonly invoicingSettings = inject(InvoicingSettingsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly terms = PAYMENT_TERMS;
  readonly vatRates = PRODUCT_VAT_RATES;

  private invoiceId: string | null = this.route.snapshot.paramMap.get('id');
  private originId: string | null = this.route.snapshot.queryParamMap.get('creditNoteOf');
  private kindParam: string | null =
    (this.route.snapshot.data['kind'] as string | undefined) ??
    this.route.snapshot.queryParamMap.get('kind');

  readonly isEdit = signal(this.invoiceId !== null);
  readonly kind = signal<InvoiceKind>(
    this.originId ? 'credit_note' : this.kindParam === 'quote' ? 'quote' : 'invoice',
  );
  readonly currency = signal(this.tenantService.currentTenant()?.currency ?? 'USD');

  readonly customers = signal<PickerItem[]>([]);
  readonly productOptions = signal<PickerItem[]>([]);
  private catalog: Product[] = [];
  private lastPostedDate: string | null = null;

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly totals = signal<InvoiceTotals>(emptyTotals());

  private optionsReady = signal(false);
  private docReady = signal(false);

  readonly form = this.fb.nonNullable.group({
    customerId: ['', Validators.required],
    issueDate: [todayIso(), Validators.required],
    paymentTerms: ['net30' as PaymentTerms, Validators.required],
    dueDate: [todayIso(), Validators.required],
    stampDuty: [this.invoicingSettings.settings().defaultStampDuty, Validators.min(0)],
    notes: [''],
    lines: this.fb.nonNullable.array([this.newLine()]),
  });

  constructor() {
    const onFormChange = takeUntilDestroyed(this.destroyRef);

    this.form.controls.issueDate.valueChanges.pipe(onFormChange).subscribe(() => {
      this.syncDueDate();
      this.loadLastPosted();
    });

    this.form.controls.paymentTerms.valueChanges.pipe(onFormChange).subscribe(() => {
      this.syncDueDate();
    });

    this.form.valueChanges.pipe(onFormChange).subscribe(() => this.refreshTotals());

    this.syncDueDate();
    this.refreshTotals();
    this.loadOptions();
    this.loadLastPosted();

    if (this.originId) {
      this.loadOrigin(this.originId);
    } else if (this.invoiceId) {
      this.loadInvoice(this.invoiceId);
    } else {
      this.docReady.set(true);
      this.refreshLoading();
    }
  }

  isInvalid(controlName: HeaderControl): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  titleKey(): string {
    if (this.kind() === 'credit_note') return 'titles.newCreditNote';
    if (this.kind() === 'quote') {
      return this.isEdit() ? 'titles.editQuote' : 'titles.newQuote';
    }
    return this.isEdit() ? 'titles.editInvoice' : 'titles.newInvoice';
  }

  subtitleKey(): string {
    if (this.kind() === 'credit_note') return 'invoices.form.creditSubtitle';
    if (this.kind() === 'quote') {
      return this.isEdit() ? 'quotes.form.editSubtitle' : 'quotes.form.newSubtitle';
    }
    return this.isEdit() ? 'invoices.form.editSubtitle' : 'invoices.form.newSubtitle';
  }

  dueDateProblem(): boolean {
    if (!this.submitted()) return false;
    return this.form.controls.dueDate.value < this.form.controls.issueDate.value;
  }

  lineError(index: number, name: keyof LineFields): string | null {
    if (!this.submitted()) return null;

    const control = this.form.controls.lines.at(index).controls[name];
    if (control.valid) return null;

    if (name === 'description') return 'invoices.form.descriptionRequired';
    if (name === 'quantity') return 'invoices.form.quantityPositive';
    if (name === 'unitPrice') return 'invoices.form.priceInvalid';
    return 'invoices.form.discountInvalid';
  }

  setCustomer(customerId: string): void {
    this.form.controls.customerId.setValue(customerId);
  }

  setProduct(index: number, productId: string): void {
    const product = this.catalog.find((item) => item.id === productId);
    const group = this.form.controls.lines.at(index);
    group.controls.productId.setValue(productId);

    if (product) {
      group.patchValue({
        description: product.description,
        unitPrice: product.salePrice,
        vatRate: product.vatRate,
      });
    }
  }

  lineNet(line: LineGroup): number {
    return lineTotals(line.getRawValue(), this.currency()).net;
  }

  addLine(): void {
    this.form.controls.lines.push(this.newLine());
  }

  removeLine(index: number): void {
    if (this.form.controls.lines.length > 1) {
      this.form.controls.lines.removeAt(index);
    }
  }

  onLineShortcut(event: Event): void {
    event.preventDefault();
    this.addLine();
  }

  save(andPost: boolean): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid || this.dueDateProblem()) {
      this.form.markAllAsTouched();
      this.errorKey.set('invoices.form.checkErrors');
      return;
    }

    if (!isIssueDateChronological(this.form.controls.issueDate.value, this.lastPostedDate)) {
      this.errorKey.set('invoices.errors.dateOutOfOrder');
      return;
    }

    this.saving.set(true);

    this.service
      .saveDraft(this.buildInput())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.invoiceId = saved.id;
          this.isEdit.set(true);
          if (!andPost) {
            this.saving.set(false);
            this.router.navigate([this.detailRoute(saved.id)]);
            return;
          }
          this.post(saved.id);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private post(id: string): void {
    this.service
      .postInvoice(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (posted) => {
          this.saving.set(false);
          this.router.navigate([this.detailRoute(posted.id)]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private detailRoute(id: string): string[] {
    return this.kind() === 'quote' ? ['/quotes', id] : ['/invoices', id];
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof InvoiceError ? `invoices.errors.${error.code}` : 'invoices.form.saveError',
    );
  }

  private buildInput(): InvoiceDraftInput {
    const raw = this.form.getRawValue();
    return {
      id: this.invoiceId,
      kind: this.kind(),
      customerId: raw.customerId,
      issueDate: raw.issueDate,
      dueDate: raw.dueDate,
      paymentTerms: raw.paymentTerms,
      currency: this.currency(),
      stampDuty: Number(raw.stampDuty) || 0,
      notes: raw.notes.trim(),
      originInvoiceId: this.originId,
      lines: raw.lines.map((line) => ({
        productId: line.productId,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        discountPct: Number(line.discountPct),
        vatRate: Number(line.vatRate),
      })),
    };
  }

  private newLine(): LineGroup {
    return this.createLineGroup({
      productId: null,
      description: '',
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      vatRate: this.invoicingSettings.settings().defaultVatRate,
    });
  }

  private createLineGroup(value: InvoiceLineInput): LineGroup {
    const group = this.fb.nonNullable.group({
      productId: this.fb.nonNullable.control<string | null>(value.productId),
      description: [value.description, Validators.required],
      quantity: [value.quantity, [Validators.required, positiveNumber]],
      unitPrice: [value.unitPrice, [Validators.required, Validators.min(0)]],
      discountPct: [
        value.discountPct,
        [Validators.required, Validators.min(0), Validators.max(100)],
      ],
      vatRate: [value.vatRate, Validators.required],
    });
    return group as LineGroup;
  }

  private syncDueDate(): void {
    const { issueDate, paymentTerms } = this.form.getRawValue();
    this.form.controls.dueDate.setValue(dueDateFrom(issueDate, paymentTerms));
  }

  private refreshTotals(): void {
    const raw = this.form.getRawValue();
    this.totals.set(
      invoiceTotals({
        lines: raw.lines.map((line, index) => ({
          id: String(index),
          productId: line.productId,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountPct: Number(line.discountPct),
          vatRate: Number(line.vatRate),
        })),
        stampDuty: Number(raw.stampDuty) || 0,
        amountPaid: 0,
        currency: this.currency(),
      }),
    );
  }

  private loadOptions(): void {
    forkJoin({
      customers: this.partners.getPartners({
        page: 0,
        size: 100,
        active: true,
        sort: 'name,asc',
      }),
      products: this.productsService.getProducts({
        page: 0,
        size: 100,
        active: true,
        sort: 'name,asc',
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ customers, products }) => {
          this.customers.set(this.toCustomerOptions(customers.items));
          this.catalog = products.items;
          this.productOptions.set(
            products.items.map((product) => ({
              id: product.id,
              label: product.name,
              sublabel: product.sku,
            })),
          );
          this.optionsReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });
  }

  private toCustomerOptions(partners: Partner[]): PickerItem[] {
    return partners
      .filter((partner) => partner.isCustomer)
      .map((partner) => ({ id: partner.id, label: partner.name, sublabel: partner.email }));
  }

  private loadLastPosted(): void {
    this.service
      .getLastPostedIssueDate(this.kind(), this.form.controls.issueDate.value)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((date) => {
        this.lastPostedDate = date;
      });
  }

  private loadInvoice(id: string): void {
    this.service
      .getInvoice(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invoice) => {
          if (!invoice) {
            this.failLoading();
            return;
          }
          if (invoice.status !== 'draft') {
            this.router.navigate(['/invoices', invoice.id]);
            return;
          }
          this.kind.set(invoice.kind);
          this.originId = invoice.originInvoiceId;
          this.currency.set(invoice.currency);
          this.fillForm(invoice);
          this.docReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });
  }

  private loadOrigin(id: string): void {
    this.service
      .getInvoice(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invoice) => {
          if (!invoice || invoice.status !== 'posted') {
            this.failLoading();
            return;
          }
          this.fillForm(invoice, true);
          this.docReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });
  }

  private fillForm(invoice: Invoice, asCreditNote = false): void {
    const paymentTerms = invoice.paymentTerms;
    const issueDate = asCreditNote ? todayIso() : invoice.issueDate;

    this.form.patchValue({
      customerId: invoice.customerId,
      issueDate,
      paymentTerms,
      dueDate: dueDateFrom(issueDate, paymentTerms),
      stampDuty: asCreditNote ? 0 : invoice.stampDuty,
      notes: '',
    });

    const lines = this.form.controls.lines;
    lines.clear();
    for (const line of invoice.lines) {
      const { id, ...input } = line;
      lines.push(this.createLineGroup(input));
    }
  }

  private failLoading(): void {
    this.loadFailed.set(true);
    this.loading.set(false);
  }

  private refreshLoading(): void {
    this.loading.set(!(this.optionsReady() && this.docReady()));
  }
}

function emptyTotals(): InvoiceTotals {
  return {
    lines: [],
    totalNet: 0,
    vatByRate: [],
    totalVat: 0,
    totalTtc: 0,
    stampDuty: 0,
    totalToPay: 0,
    amountPaid: 0,
    due: 0,
  };
}

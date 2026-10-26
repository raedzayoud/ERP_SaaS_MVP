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
import { todayIso } from '../../../../shared/utils/money';
import { Partner } from '../../../crm/models/partner';
import { PartnerService } from '../../../crm/services/partner.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { PRODUCT_VAT_RATES, Product } from '../../../products/models/product';
import { ProductService } from '../../../products/services/product.service';
import { ComboPicker, PickerItem } from '../../../invoices/components/combo-picker/combo-picker';
import { SalesDraftInput, SalesLine, SalesLineInput } from '../../models/sales-order';
import { SalesError, SalesOrderService } from '../../services/sales-order.service';
import { SalesTotals, salesTotals } from '../../utils/sales-calc';

interface LineFields {
  productId: FormControl<string | null>;
  reference: FormControl<string>;
  description: FormControl<string>;
  unit: FormControl<string>;
  quantity: FormControl<number>;
  unitPrice: FormControl<number>;
  discountPct: FormControl<number>;
  vatRate: FormControl<number>;
}

type LineGroup = FormGroup<LineFields>;
type HeaderControl = 'customerId' | 'orderDate' | 'expectedDate' | 'paymentTerms';

function positiveNumber(control: AbstractControl): ValidationErrors | null {
  return Number(control.value) > 0 ? null : { positive: true };
}

@Component({
  selector: 'app-sales-order-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective, ComboPicker],
  templateUrl: './sales-order-form.html',
  styleUrl: './sales-order-form.css',
})
export class SalesOrderForm {
  private readonly service = inject(SalesOrderService);
  private readonly partners = inject(PartnerService);
  private readonly productsService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly terms = PAYMENT_TERMS;
  readonly vatRates = PRODUCT_VAT_RATES;

  private readonly tenantService = inject(TenantService);

  /** The currency of the current workspace, used for all money displays. */
  get currency(): string {
    return this.tenantService.activeCurrency();
  }

  private orderId: string | null = this.route.snapshot.paramMap.get('id');

  readonly isEdit = signal(this.orderId !== null);

  readonly customers = signal<PickerItem[]>([]);
  readonly productOptions = signal<PickerItem[]>([]);
  private readonly catalog = signal<Product[]>([]);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly totals = signal<SalesTotals>(emptyTotals());

  private optionsReady = signal(false);
  private docReady = signal(false);

  readonly form = this.fb.nonNullable.group({
    customerId: ['', Validators.required],
    orderDate: [todayIso(), Validators.required],
    expectedDate: [todayIso(), Validators.required],
    paymentTerms: ['net30' as PaymentTerms, Validators.required],
    notes: [''],
    lines: this.fb.nonNullable.array([this.newLine()]),
  });

  constructor() {
    const onFormChange = takeUntilDestroyed(this.destroyRef);

    this.form.valueChanges.pipe(onFormChange).subscribe(() => this.refreshTotals());

    this.refreshTotals();
    this.loadOptions();

    if (this.orderId) {
      this.loadOrder(this.orderId);
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
    return this.isEdit() ? 'titles.editSalesOrder' : 'titles.newSalesOrder';
  }

  expectedDateProblem(): boolean {
    if (!this.submitted()) return false;
    return this.form.controls.expectedDate.value < this.form.controls.orderDate.value;
  }

  lineError(index: number, name: keyof LineFields): string | null {
    if (!this.submitted()) return null;

    const control = this.form.controls.lines.at(index).controls[name];
    if (control.valid) return null;

    if (name === 'description') return 'sales.form.descriptionRequired';
    if (name === 'quantity') return 'sales.form.quantityPositive';
    if (name === 'unitPrice') return 'sales.form.priceInvalid';
    return 'sales.form.discountInvalid';
  }

  setCustomer(customerId: string): void {
    this.form.controls.customerId.setValue(customerId);
  }

  setProduct(index: number, productId: string): void {
    const product = this.catalog().find((item) => item.id === productId);
    const group = this.form.controls.lines.at(index);
    group.controls.productId.setValue(productId);

    if (product) {
      group.patchValue({
        reference: product.sku,
        description: product.description,
        unit: product.unit,
        unitPrice: product.salePrice,
        vatRate: product.vatRate,
      });
    }
  }

  lineNet(line: LineGroup): number {
    const raw = line.getRawValue();
    return salesTotals(
      [
        {
          id: 'preview',
          productId: raw.productId,
          reference: raw.reference,
          description: raw.description,
          unit: raw.unit,
          quantity: Number(raw.quantity),
          unitPrice: Number(raw.unitPrice),
          discountPct: Number(raw.discountPct),
          vatRate: Number(raw.vatRate),
        },
      ],
      this.currency,
    ).totalNet;
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

  save(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid || this.expectedDateProblem()) {
      this.form.markAllAsTouched();
      this.errorKey.set('sales.form.checkErrors');
      return;
    }

    this.saving.set(true);

    this.service
      .saveDraft(this.buildInput())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.router.navigate(['/sales-orders', saved.id]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof SalesError ? `sales.errors.${error.code}` : 'sales.form.saveError',
    );
  }

  private buildInput(): SalesDraftInput {
    const raw = this.form.getRawValue();
    return {
      id: this.orderId,
      customerId: raw.customerId,
      orderDate: raw.orderDate,
      expectedDate: raw.expectedDate,
      paymentTerms: raw.paymentTerms,
      currency: this.currency,
      notes: raw.notes.trim(),
      lines: raw.lines.map((line) => ({
        productId: line.productId,
        reference: line.reference.trim(),
        description: line.description.trim(),
        unit: line.unit,
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
      reference: '',
      description: '',
      unit: 'piece',
      quantity: 1,
      unitPrice: 0,
      discountPct: 0,
      vatRate: 0,
    });
  }

  private createLineGroup(value: SalesLineInput): LineGroup {
    const group = this.fb.nonNullable.group({
      productId: this.fb.nonNullable.control<string | null>(value.productId),
      reference: [value.reference],
      description: [value.description, Validators.required],
      unit: [value.unit],
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

  private refreshTotals(): void {
    const raw = this.form.getRawValue();
    this.totals.set(
      salesTotals(
        raw.lines.map((line, index) => ({
          id: String(index),
          productId: line.productId,
          reference: line.reference,
          description: line.description,
          unit: line.unit,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          discountPct: Number(line.discountPct),
          vatRate: Number(line.vatRate),
        })),
        this.currency,
      ),
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
          this.catalog.set(products.items);
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

  private loadOrder(id: string): void {
    this.service
      .getOrder(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          if (!order) {
            this.failLoading();
            return;
          }
          if (order.status !== 'draft') {
            this.router.navigate(['/sales-orders', order.id]);
            return;
          }
          this.fillForm(order);
          this.docReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });
  }

  private fillForm(order: {
    customerId: string;
    orderDate: string;
    expectedDate: string;
    paymentTerms: PaymentTerms;
    notes: string;
    lines: SalesLine[];
  }): void {
    this.form.patchValue({
      customerId: order.customerId,
      orderDate: order.orderDate,
      expectedDate: order.expectedDate,
      paymentTerms: order.paymentTerms,
      notes: order.notes,
    });

    const lines = this.form.controls.lines;
    lines.clear();
    for (const line of order.lines) {
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

function emptyTotals(): SalesTotals {
  return {
    lines: [],
    totalNet: 0,
    vatByRate: [],
    totalVat: 0,
    totalTtc: 0,
  };
}

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
import { addDaysIso, todayIso } from '../../../../shared/utils/money';
import { PartnerService } from '../../../crm/services/partner.service';
import { Product, PRODUCT_VAT_RATES } from '../../../products/models/product';
import { ProductService } from '../../../products/services/product.service';
import { PurchaseOrder } from '../../models/purchase-order';
import { PurchaseService } from '../../services/purchase.service';
import { SupplierBillService, SupplierBillError } from '../../services/supplier-bill.service';
import { ComboPicker, PickerItem } from '../../../invoices/components/combo-picker/combo-picker';

interface LineFields {
  productId: FormControl<string | null>;
  reference: FormControl<string>;
  description: FormControl<string>;
  unit: FormControl<string>;
  quantity: FormControl<number>;
  unitCost: FormControl<number>;
  vatRate: FormControl<number>;
}

interface LineValues {
  productId: string | null;
  reference: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  vatRate: number;
}

type LineGroup = FormGroup<LineFields>;

function positiveNumber(control: AbstractControl): ValidationErrors | null {
  return Number(control.value) > 0 ? null : { positive: true };
}

@Component({
  selector: 'app-supplier-bill-form',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective, ComboPicker],
  templateUrl: './supplier-bill-form.html',
  styleUrl: './supplier-bill-form.css',
})
export class SupplierBillForm {
  private readonly bills = inject(SupplierBillService);
  private readonly orders = inject(PurchaseService);
  private readonly partners = inject(PartnerService);
  private readonly productsService = inject(ProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly vatRates = PRODUCT_VAT_RATES;
  readonly orderMode = this.route.snapshot.queryParamMap.has('orderId');

  readonly suppliers = signal<PickerItem[]>([]);
  readonly productOptions = signal<PickerItem[]>([]);
  private readonly catalog = signal<Product[]>([]);

  private readonly orderRef = signal<PurchaseOrder | null>(null);

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly totals = signal(emptyTotals());

  private optionsReady = signal(false);
  private docReady = signal(!this.orderMode);

  readonly form = this.fb.nonNullable.group({
    supplierId: ['', Validators.required],
    billingDate: [todayIso(), Validators.required],
    dueDate: [addDaysIso(todayIso(), 30), Validators.required],
    notes: [''],
    lines: this.fb.nonNullable.array([this.newLine()]),
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refreshTotals());

    this.refreshTotals();
    this.loadOptions();

    const orderId = this.route.snapshot.queryParamMap.get('orderId');
    if (this.orderMode && orderId) {
      this.loadOrder(orderId);
    } else {
      this.docReady.set(true);
      this.refreshLoading();
    }
  }

  isInvalid(controlName: 'billingDate' | 'dueDate'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  titleKey(): string {
    return this.orderMode ? 'titles.newBillFromOrder' : 'titles.newSupplierBill';
  }

  dueDateProblem(): boolean {
    if (!this.submitted()) return false;
    return this.form.controls.dueDate.value < this.form.controls.billingDate.value;
  }

  order(): PurchaseOrder | null {
    return this.orderRef();
  }

  lineError(index: number, name: keyof LineFields): string | null {
    if (!this.submitted()) return null;

    const control = this.form.controls.lines.at(index).controls[name];
    if (control.valid) return null;

    if (name === 'description') return 'purchases.form.descriptionRequired';
    if (name === 'quantity') return 'purchases.bills.form.quantityPositive';
    if (name === 'unitCost') return 'purchases.bills.form.costInvalid';
    return 'purchases.bills.form.descriptionRequired';
  }

  setSupplier(supplierId: string): void {
    this.form.controls.supplierId.setValue(supplierId);
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
        unitCost: product.purchasePrice,
        vatRate: product.vatRate,
      });
    }
  }

  lineNet(line: LineGroup): number {
    const raw = line.getRawValue();
    return Number(raw.quantity) * Number(raw.unitCost);
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

    if (this.orderMode) {
      // The free-lines array stays empty in this mode: only validate the header.
      const headerInvalid =
        this.form.controls.billingDate.invalid || this.form.controls.dueDate.invalid;
      if (headerInvalid || this.dueDateProblem()) {
        this.form.markAllAsTouched();
        this.errorKey.set('purchases.form.checkErrors');
        return;
      }
    } else if (this.form.invalid || this.dueDateProblem()) {
      this.form.markAllAsTouched();
      this.errorKey.set('purchases.form.checkErrors');
      return;
    }

    this.saving.set(true);

    if (this.orderMode && this.orderRef()) {
      this.saveFromOrder();
    } else {
      this.saveStandalone();
    }
  }

  private saveFromOrder(): void {
    const raw = this.form.getRawValue();
    this.bills
      .createFromOrder({
        orderId: this.orderRef()!.id,
        billingDate: raw.billingDate,
        dueDate: raw.dueDate,
        notes: raw.notes.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.router.navigate(['/supplier-bills', saved.id]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private saveStandalone(): void {
    const raw = this.form.getRawValue();
    this.bills
      .saveDraft({
        id: null,
        supplierId: raw.supplierId,
        billingDate: raw.billingDate,
        dueDate: raw.dueDate,
        notes: raw.notes.trim(),
        lines: raw.lines.map((line) => ({
          productId: line.productId,
          reference: line.reference.trim() || '—',
          description: line.description.trim(),
          unit: line.unit,
          quantity: Number(line.quantity),
          unitCost: Number(line.unitCost),
          vatRate: Number(line.vatRate),
        })),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.saving.set(false);
          this.router.navigate(['/supplier-bills', saved.id]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof SupplierBillError
        ? `purchases.bills.errors.${error.code}`
        : 'purchases.bills.form.saveError',
    );
  }

  private loadOrder(orderId: string): void {
    this.orders
      .getOrder(orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          if (!order || order.status !== 'confirmed') {
            this.loadFailed.set(true);
            this.loading.set(false);
            return;
          }
          this.orderRef.set(order);
          this.form.controls.supplierId.setValue(order.supplierId);
          this.totals.set(this.totalsFromOrder(order));
          this.docReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });
  }

  private loadOptions(): void {
    this.partners
      .getPartners({ page: 0, size: 100, active: true, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.suppliers.set(
            page.items
              .filter((partner) => partner.isSupplier)
              .map((partner) => ({ id: partner.id, label: partner.name, sublabel: partner.email })),
          );
          this.optionsReady.set(true);
          this.refreshLoading();
        },
        error: () => this.failLoading(),
      });

    this.productsService
      .getProducts({ page: 0, size: 100, active: true, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.catalog.set(page.items);
          this.productOptions.set(
            page.items.map((product) => ({
              id: product.id,
              label: product.name,
              sublabel: product.sku,
            })),
          );
        },
        error: () => undefined,
      });
  }

  private newLine(): LineGroup {
    return this.createLineGroup({
      productId: null,
      reference: '',
      description: '',
      unit: 'piece',
      quantity: 1,
      unitCost: 0,
      vatRate: 0,
    });
  }

  private createLineGroup(value: LineValues): LineGroup {
    const group = this.fb.nonNullable.group({
      productId: this.fb.nonNullable.control<string | null>(value.productId),
      reference: [value.reference],
      description: [value.description, Validators.required],
      unit: [value.unit],
      quantity: [value.quantity, [Validators.required, positiveNumber]],
      unitCost: [value.unitCost, [Validators.required, Validators.min(0)]],
      vatRate: [value.vatRate, Validators.required],
    });
    return group as LineGroup;
  }

  private totalsFromOrder(order: PurchaseOrder): TotalsView {
    const received = order.lines.filter((line) => line.receivedQty > 0);

    const totalNet = received.reduce(
      (sum, line) => sum + line.receivedQty * line.unitCost,
      0,
    );
    const totalVat = received.reduce(
      (sum, line) => sum + line.receivedQty * line.unitCost * (line.vatRate / 100),
      0,
    );

    return {
      totalNet: Math.round(totalNet * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalTtc: Math.round((totalNet + totalVat) * 100) / 100,
    };
  }

  private refreshTotals(): void {
    const raw = this.form.getRawValue();
    const lines = raw.lines.map((line) => ({
      quantity: Number(line.quantity),
      unitCost: Number(line.unitCost),
      vatRate: Number(line.vatRate),
    }));

    const totalNet = lines.reduce((sum, line) => sum + line.quantity * line.unitCost, 0);
    const totalVat = lines.reduce(
      (sum, line) => sum + line.quantity * line.unitCost * (line.vatRate / 100),
      0,
    );

    this.totals.set({
      totalNet: Math.round(totalNet * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      totalTtc: Math.round((totalNet + totalVat) * 100) / 100,
    });
  }

  private failLoading(): void {
    this.loadFailed.set(true);
    this.loading.set(false);
  }

  private refreshLoading(): void {
    this.loading.set(!(this.optionsReady() && this.docReady()));
  }
}

interface TotalsView {
  totalNet: number;
  totalVat: number;
  totalTtc: number;
}

function emptyTotals(): TotalsView {
  return { totalNet: 0, totalVat: 0, totalTtc: 0 };
}

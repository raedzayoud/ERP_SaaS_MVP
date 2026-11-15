import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProductService } from '../../services/product.service';
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_VAT_RATES,
  Product,
  ProductInput,
  ProductType,
} from '../../models/product';
import { Partner } from '../../../crm/models/partner';
import { PartnerService } from '../../../crm/services/partner.service';
import { StockService } from '../../../stock/services/stock.service';
import { Warehouse } from '../../../stock/models/warehouse';
import { TenantService } from '../../../../core/services/tenant.service';

type CheckedControl =
  | 'sku'
  | 'name'
  | 'salePrice'
  | 'purchasePrice'
  | 'minStock';
type SupplierControlName = 'supplierId' | 'supplierRef' | 'price' | 'minQty' | 'delayDays';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
})
export class ProductForm {
  private readonly service = inject(ProductService);
  private readonly partners = inject(PartnerService);
  private readonly stock = inject(StockService);
  private readonly tenantService = inject(TenantService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = PRODUCT_CATEGORIES;
  readonly units = PRODUCT_UNITS;
  readonly vatRates = PRODUCT_VAT_RATES;
  readonly productId = this.route.snapshot.paramMap.get('id');
  readonly isEdit = this.productId !== null;

  loading = signal(this.isEdit);
  loadFailed = signal(false);
  saving = signal(false);
  submitFailed = signal(false);
  submitted = signal(false);

  type = signal<ProductType>('good');
  supplierOptions = signal<Partner[]>([]);
  warehouses = signal<Warehouse[]>([]);

  /** The opening stock is only offered when the workspace manages a stock. */
  readonly hasStockModule = computed(() => this.tenantService.isModuleEnabled('stock'));

  form = this.fb.nonNullable.group({
    type: ['good' as ProductType, Validators.required],
    sku: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['hardware'],
    unit: ['piece'],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    purchasePrice: [0, Validators.min(0)],
    vatRate: [0, Validators.required],
    minStock: [0, Validators.min(0)],
    openingWarehouseId: [''],
    openingQuantity: [0, Validators.min(0)],
    description: [''],
    suppliers: this.fb.nonNullable.array([this.newSupplierGroup()]),
  });

  constructor() {
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.type.set(value));

    this.loadSupplierOptions();
    this.loadWarehouses();

    if (this.productId) {
      this.loadProduct(this.productId);
    }
  }

  addSupplier(): void {
    this.form.controls.suppliers.push(this.newSupplierGroup());
  }

  removeSupplier(index: number): void {
    this.form.controls.suppliers.removeAt(index);
  }

  supplierFieldInvalid(index: number, name: SupplierControlName): boolean {
    const control = this.form.controls.suppliers.at(index).controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  isInvalid(controlName: CheckedControl): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  hasError(controlName: CheckedControl, error: string): boolean {
    return this.isInvalid(controlName) && this.form.controls[controlName].hasError(error);
  }

  submit(): void {
    this.submitted.set(true);
    this.submitFailed.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const input: ProductInput = {
      type: raw.type,
      sku: raw.sku.trim(),
      name: raw.name.trim(),
      category: raw.category,
      unit: raw.unit,
      salePrice: Number(raw.salePrice),
      purchasePrice: Number(raw.purchasePrice),
      vatRate: Number(raw.vatRate),
      minStock: Number(raw.minStock),
      description: raw.description.trim(),
      suppliers: raw.suppliers.map((entry) => ({
        supplierId: entry.supplierId,
        supplierRef: entry.supplierRef.trim(),
        price: Number(entry.price),
        minQty: Number(entry.minQty),
        delayDays: Number(entry.delayDays),
      })),
    };

    // The opening stock is only set when the product is created.
    const openingStock = this.openingStock(raw.openingWarehouseId, Number(raw.openingQuantity));
    if (!this.isEdit && openingStock) {
      input.openingStock = openingStock;
    }

    this.saving.set(true);

    const request$ =
      this.isEdit && this.productId
        ? this.service.updateProduct(this.productId, input)
        : this.service.createProduct(input);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.router.navigate(['/products']);
      },
      error: () => {
        this.saving.set(false);
        this.submitFailed.set(true);
      },
    });
  }

  private newSupplierGroup(entry?: {
    supplierId: string;
    supplierRef: string;
    price: number;
    minQty: number;
    delayDays: number;
  }) {
    return this.fb.nonNullable.group({
      supplierId: [entry?.supplierId ?? '', Validators.required],
      supplierRef: [entry?.supplierRef ?? ''],
      price: [entry?.price ?? 0, [Validators.required, Validators.min(0)]],
      minQty: [entry?.minQty ?? 1, [Validators.required, Validators.min(1)]],
      delayDays: [entry?.delayDays ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  /** The opening stock to record, when the user filled it in. */
  private openingStock(
    warehouseId: string,
    quantity: number,
  ): { warehouseId: string; quantity: number } | null {
    if (!warehouseId || quantity <= 0) {
      return null;
    }
    return { warehouseId, quantity };
  }

  private loadWarehouses(): void {
    if (!this.hasStockModule()) {
      return;
    }
    this.stock
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => this.warehouses.set(list.filter((warehouse) => warehouse.active)),
        error: () => this.warehouses.set([]),
      });
  }

  private loadSupplierOptions(): void {
    this.partners
      .getPartners({ page: 0, size: 50, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) =>
          this.supplierOptions.set(page.items.filter((partner) => partner.isSupplier)),
        error: () => this.supplierOptions.set([]),
      });
  }

  private loadProduct(id: string): void {
    this.loading.set(true);

    this.service
      .getProduct(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (product) => {
          if (product) {
            this.fillForm(product);
          } else {
            this.loadFailed.set(true);
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  private fillForm(product: Product): void {
    // The supplier rows are rebuilt: the array starts with one empty row.
    this.form.controls.suppliers.clear();
    for (const entry of product.suppliers) {
      this.form.controls.suppliers.push(this.newSupplierGroup(entry));
    }

    this.form.patchValue({
      type: product.type,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      salePrice: product.salePrice,
      purchasePrice: product.purchasePrice,
      vatRate: product.vatRate,
      minStock: product.minStock ?? 0,
      openingWarehouseId: '',
      openingQuantity: 0,
      description: product.description,
    });
  }
}

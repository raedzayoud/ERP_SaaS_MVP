import { Component, DestroyRef, inject, signal } from '@angular/core';
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

type CheckedControl = 'sku' | 'name' | 'salePrice';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './product-form.html',
})
export class ProductForm {
  private readonly service = inject(ProductService);
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

  form = this.fb.nonNullable.group({
    type: ['good' as ProductType, Validators.required],
    sku: ['', [Validators.required, Validators.minLength(2)]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    category: ['hardware'],
    unit: ['piece'],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    vatRate: [0, Validators.required],
    description: [''],
  });

  constructor() {
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.type.set(value));

    if (this.productId) {
      this.loadProduct(this.productId);
    }
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
      vatRate: Number(raw.vatRate),
      description: raw.description.trim(),
    };

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
    this.form.setValue({
      type: product.type,
      sku: product.sku,
      name: product.name,
      category: product.category,
      unit: product.unit,
      salePrice: product.salePrice,
      vatRate: product.vatRate,
      description: product.description,
    });
  }
}

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { todayIso } from '../../../../shared/utils/money';
import { Product } from '../../../products/models/product';
import { ProductService } from '../../../products/services/product.service';
import { MovementDirection } from '../../models/stock-movement';
import { Warehouse } from '../../models/warehouse';
import { StockError, StockService } from '../../services/stock.service';

@Component({
  selector: 'app-stock-adjustment',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './stock-adjustment.html',
  styleUrl: './stock-adjustment.css',
})
export class StockAdjustment {
  private readonly service = inject(StockService);
  private readonly productsService = inject(ProductService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  products = signal<Product[]>([]);
  warehouses = signal<Warehouse[]>([]);
  saving = signal(false);
  submitted = signal(false);
  errorKey = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    date: [todayIso(), Validators.required],
    productId: ['', Validators.required],
    warehouseId: ['', Validators.required],
    direction: ['in' as MovementDirection, Validators.required],
    quantity: [1, [Validators.required, Validators.min(0.001)]],
    reason: ['', Validators.required],
  });

  constructor() {
    this.loadOptions();
  }

  isInvalid(name: 'date' | 'productId' | 'warehouseId' | 'quantity' | 'reason'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  save(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('stock.adjustment.checkErrors');
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    this.service
      .createAdjustment({
        date: raw.date,
        productId: raw.productId,
        warehouseId: raw.warehouseId,
        direction: raw.direction,
        quantity: Number(raw.quantity),
        reason: raw.reason,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/stock']);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private loadOptions(): void {
    this.productsService
      .getProducts({ page: 0, size: 500, type: 'good', active: true, sort: 'name,asc' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((page) => this.products.set(page.items));

    this.service
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((warehouses) => this.warehouses.set(warehouses.filter((w) => w.active)));
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof StockError ? `stock.errors.${error.code}` : 'stock.adjustment.saveError',
    );
  }
}

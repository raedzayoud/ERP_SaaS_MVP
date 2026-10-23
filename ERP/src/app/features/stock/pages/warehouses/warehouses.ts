import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Warehouse } from '../../models/warehouse';
import { StockError, StockService } from '../../services/stock.service';

@Component({
  selector: 'app-warehouses',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './warehouses.html',
  styleUrl: './warehouses.css',
})
export class Warehouses {
  private readonly service = inject(StockService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  warehouses = signal<Warehouse[]>([]);
  loading = signal(true);
  saving = signal(false);
  submitted = signal(false);
  errorKey = signal<string | null>(null);
  busyId = signal<string | null>(null);

  activeCount = computed(() => this.warehouses().filter((w) => w.active).length);

  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    name: ['', Validators.required],
  });

  constructor() {
    this.load();
  }

  isInvalid(name: 'code' | 'name'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  save(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('stock.warehouses.checkErrors');
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    this.service
      .createWarehouse({ code: raw.code, name: raw.name })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.submitted.set(false);
          this.form.reset({ code: '', name: '' });
          this.load();
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  archive(warehouse: Warehouse): void {
    this.busyId.set(warehouse.id);
    this.errorKey.set(null);

    const request$ = warehouse.active
      ? this.service.archiveWarehouse(warehouse.id)
      : this.service.restoreWarehouse(warehouse.id);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busyId.set(null);
        this.load();
      },
      error: (error: unknown) => {
        this.busyId.set(null);
        this.errorKey.set(
          error instanceof StockError
            ? `stock.errors.${error.code}`
            : 'stock.warehouses.archiveError',
        );
      },
    });
  }

  private load(): void {
    this.loading.set(true);

    this.service
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (warehouses) => {
          this.warehouses.set(warehouses);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof StockError ? `stock.errors.${error.code}` : 'stock.warehouses.saveError',
    );
  }
}

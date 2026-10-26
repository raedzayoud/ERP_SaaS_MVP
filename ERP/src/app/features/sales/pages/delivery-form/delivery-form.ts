import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, forkJoin } from 'rxjs';
import { MAIN_WAREHOUSE_ID, Warehouse } from '../../../stock/models/warehouse';
import { StockService } from '../../../stock/services/stock.service';
import { todayIso } from '../../../../shared/utils/money';
import { SalesOrder } from '../../models/sales-order';
import { DeliveryError } from '../../models/delivery-note';
import { DeliveryNoteService } from '../../services/delivery-note.service';
import { SalesOrderService } from '../../services/sales-order.service';

interface DeliveryFields {
  salesOrderId: FormControl<string>;
  deliveryDate: FormControl<string>;
  warehouseId: FormControl<string>;
  notes: FormControl<string>;
}

@Component({
  selector: 'app-delivery-form',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective, CurrencyPipe],
  templateUrl: './delivery-form.html',
  styleUrl: './delivery-form.css',
})
export class DeliveryForm {
  private readonly deliveries = inject(DeliveryNoteService);
  private readonly orders = inject(SalesOrderService);
  private readonly stock = inject(StockService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  readonly candidates = signal<SalesOrder[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly selectedOrder = computed<SalesOrder | undefined>(() =>
    this.candidates().find((order) => order.id === this.form.value.salesOrderId),
  );

  readonly form = this.fb.group<DeliveryFields>({
    salesOrderId: this.fb.nonNullable.control('', Validators.required),
    deliveryDate: this.fb.nonNullable.control(todayIso(), Validators.required),
    warehouseId: this.fb.nonNullable.control(MAIN_WAREHOUSE_ID, Validators.required),
    notes: this.fb.nonNullable.control(''),
  });

  constructor() {
    const sourceId = this.route.snapshot.queryParamMap.get('source');
    if (sourceId) this.form.patchValue({ salesOrderId: sourceId });

    this.form.controls.salesOrderId.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.errorKey.set(null));

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    const confirmedOrders = this.orders
      .getOrders({ status: 'confirmed', page: 0, size: 200 })
      .pipe(takeUntilDestroyed(this.destroyRef));
    const issued = this.deliveries.getDeliveries({ sort: 'deliveryDate,desc' }).pipe(
      takeUntilDestroyed(this.destroyRef),
    );

    forkJoin({
      orders: confirmedOrders,
      deliveries: issued,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ orders, deliveries }) => {
          const delivered = new Set(deliveries.items.map((note) => note.salesOrderId));
          this.candidates.set(orders.items.filter((order) => !delivered.has(order.id)));
          this.stock
            .getWarehouses()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (warehouses) => {
                this.warehouses.set(warehouses.filter((warehouse) => warehouse.active));
                this.loading.set(false);
              },
              error: () => this.finishFailure(),
            });
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  onOrderSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.form.patchValue({ salesOrderId: value });
    this.errorKey.set(null);
  }

  createDelivery(): void {
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('deliveries.form.checkErrors');
      return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();

    this.deliveries
      .create({
        salesOrderId: raw.salesOrderId,
        warehouseId: raw.warehouseId,
        deliveryDate: raw.deliveryDate,
        notes: raw.notes,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note) => {
          this.saving.set(false);
          this.router.navigate(['/deliveries', note.id]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private finishFailure(): void {
    this.loading.set(false);
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof DeliveryError
        ? `deliveries.errors.${error.code}`
        : 'deliveries.form.saveError',
    );
  }
}

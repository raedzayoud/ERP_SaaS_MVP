import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { todayIso } from '../../../../shared/utils/money';
import { PurchaseLine, PurchaseOrder, ReceiveInput } from '../../models/purchase-order';
import { PurchaseError, PurchaseService } from '../../services/purchase.service';
import { isReceivable, remainingQty } from '../../utils/purchase-calc';
import { MAIN_WAREHOUSE_ID, Warehouse } from '../../../stock/models/warehouse';
import { StockService } from '../../../stock/services/stock.service';

@Component({
  selector: 'app-purchase-receive',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './purchase-receive.html',
  styleUrl: './purchase-receive.css',
})
export class PurchaseReceive {
  private readonly service = inject(PurchaseService);
  private readonly stock = inject(StockService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly orderId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly order = signal<PurchaseOrder | null>(null);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly errorKey = signal<string | null>(null);

  readonly quantities = signal<Record<string, number>>({});

  readonly openLines = computed(() => {
    const order = this.order();
    if (!order) return [] as PurchaseLine[];
    return order.lines.filter((line) => remainingQty(line) > 0);
  });

  readonly form = this.fb.nonNullable.group({
    date: [todayIso(), Validators.required],
    blNumber: [''],
    warehouseId: [MAIN_WAREHOUSE_ID, Validators.required],
  });

  constructor() {
    this.load();
    this.loadWarehouses();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    if (!this.orderId) {
      this.loadFailed.set(true);
      this.loading.set(false);
      return;
    }

    this.service
      .getOrder(this.orderId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (order) => {
          if (!order || !isReceivable(order)) {
            this.router.navigate(['/purchases', this.orderId]);
            return;
          }
          this.order.set(order);
          this.initQuantities(order);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  setQuantity(lineId: string, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    const value = Number(raw);
    this.quantities.update((current) => ({
      ...current,
      [lineId]: Number.isFinite(value) ? value : 0,
    }));
  }

  quantityOf(lineId: string): number {
    return this.quantities()[lineId] ?? 0;
  }

  remainingOf(line: PurchaseLine): number {
    return remainingQty(line);
  }

  lineProblem(line: PurchaseLine): boolean {
    if (!this.submitted()) return false;
    const value = this.quantityOf(line.id);
    return value < 0 || value > remainingQty(line);
  }

  save(): void {
    this.submitted.set(true);
    this.errorKey.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorKey.set('purchases.receive.checkErrors');
      return;
    }

    const order = this.order();
    if (!order) return;

    const items = this.openLines()
      .map((line) => ({ lineId: line.id, quantity: this.quantityOf(line.id) }))
      .filter((item) => item.quantity > 0);

    if (items.length === 0) {
      this.errorKey.set('purchases.receive.empty');
      return;
    }

    const invalid = this.openLines().some((line) => {
      const value = this.quantityOf(line.id);
      return value > remainingQty(line);
    });
    if (invalid) {
      this.errorKey.set('purchases.errors.invalidReceiveQty');
      return;
    }

    const raw = this.form.getRawValue();
    const input: ReceiveInput = {
      date: raw.date,
      blNumber: raw.blNumber.trim(),
      warehouseId: raw.warehouseId,
      items,
    };

    this.saving.set(true);

    this.service
      .receiveOrder(this.orderId, input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.router.navigate(['/purchases', this.orderId]);
        },
        error: (error: unknown) => this.onSaveError(error),
      });
  }

  private initQuantities(order: PurchaseOrder): void {
    const values: Record<string, number> = {};
    for (const line of order.lines) {
      if (remainingQty(line) > 0) values[line.id] = 0;
    }
    this.quantities.set(values);
  }

  private loadWarehouses(): void {
    this.stock
      .getWarehouses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((warehouses) => this.warehouses.set(warehouses.filter((w) => w.active)));
  }

  private onSaveError(error: unknown): void {
    this.saving.set(false);
    this.errorKey.set(
      error instanceof PurchaseError
        ? `purchases.errors.${error.code}`
        : 'purchases.receive.saveError',
    );
  }
}

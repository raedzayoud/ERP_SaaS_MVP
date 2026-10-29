import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { PartnerService } from '../../../crm/services/partner.service';
import { ProductService } from '../../../products/services/product.service';
import { PurchaseOrder } from '../../../purchases/models/purchase-order';
import { PurchaseService } from '../../../purchases/services/purchase.service';

@Component({
  selector: 'app-buyer-dashboard',
  imports: [DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './buyer-dashboard.html',
  styleUrl: './buyer-dashboard.css',
})
export class BuyerDashboard {
  private readonly purchasesService = inject(PurchaseService);
  private readonly partnersService = inject(PartnerService);
  private readonly productsService = inject(ProductService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  pending = signal(0);
  late = signal(0);
  suppliers = signal(0);
  products = signal(0);
  recentOrders = signal<PurchaseOrder[]>([]);

  loading = signal(true);
  loadFailed = signal(false);

  readonly quickActions = [
    { labelKey: 'dashboard.quick.newOrder', icon: '🛒', route: '/purchases/new' },
    { labelKey: 'dashboard.roles.buyer.quick.orders', icon: '📋', route: '/purchases' },
    { labelKey: 'dashboard.roles.buyer.quick.suppliers', icon: '👥', route: '/contacts' },
    { labelKey: 'dashboard.roles.buyer.quick.products', icon: '📦', route: '/products' },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    forkJoin({
      purchaseSummary: this.purchasesService.getSummary(),
      orders: this.purchasesService.getOrders({ page: 0, size: 5 }),
      partners: this.partnersService.getPartners({
        page: 0,
        size: 500,
        active: true,
      }),
      products: this.productsService.getProducts({
        page: 0,
        size: 1,
        active: true,
      }),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.pending.set(data.purchaseSummary.awaiting);
          this.late.set(data.purchaseSummary.late);
          this.recentOrders.set(
            data.orders.items.filter((order) => order.status !== 'cancelled'),
          );
          this.suppliers.set(data.partners.items.filter((partner) => partner.isSupplier).length);
          this.products.set(data.products.total);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }
}

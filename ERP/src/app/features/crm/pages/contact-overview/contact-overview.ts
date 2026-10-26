import { CurrencyPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PartnerService } from '../../services/partner.service';
import { Partner } from '../../models/partner';
import { InvoiceService } from '../../../invoices/services/invoice.service';
import { dueFor, paymentState } from '../../../invoices/utils/invoice-calc';
import { PurchaseService } from '../../../purchases/services/purchase.service';
import { purchaseTotals } from '../../../purchases/utils/purchase-calc';
import { ProductService } from '../../../products/services/product.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { roundMoney } from '../../../../shared/utils/money';

@Component({
  selector: 'app-contact-overview',
  imports: [CurrencyPipe, RouterLink, TranslocoDirective],
  templateUrl: './contact-overview.html',
  styleUrl: './contact-overview.css',
})
export class ContactOverview {
  private readonly route = inject(ActivatedRoute);
  private readonly partnerService = inject(PartnerService);
  private readonly invoiceService = inject(InvoiceService);
  private readonly purchaseService = inject(PurchaseService);
  private readonly productService = inject(ProductService);
  private readonly tenantService = inject(TenantService);
  private readonly destroyRef = inject(DestroyRef);

  readonly partnerId = this.route.snapshot.paramMap.get('id');

  partner = signal<Partner | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  invoiceCount = signal(0);
  invoiceDue = signal(0);
  quoteCount = signal(0);
  purchaseCount = signal(0);
  purchaseTotal = signal(0);
  productCount = signal(0);

  currency = computed(() => this.tenantService.currentTenant()?.currency ?? 'USD');

  constructor() {
    if (!this.partnerId) {
      this.loading.set(false);
      this.loadFailed.set(true);
      return;
    }

    this.partnerService
      .getPartner(this.partnerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (partner) => {
          if (!partner) {
            this.loading.set(false);
            this.loadFailed.set(true);
            return;
          }
          this.partner.set(partner);
          this.loading.set(false);
          this.loadRelated(partner);
        },
        error: () => {
          this.loading.set(false);
          this.loadFailed.set(true);
        },
      });
  }

  hasModule(moduleId: string): boolean {
    return this.tenantService.isModuleEnabled(moduleId);
  }

  private loadRelated(partner: Partner): void {
    if (this.hasModule('invoices')) {
      this.invoiceService
        .getInvoices({ page: 0, size: 500, sort: 'issueDate,desc' })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => {
          const forCustomer = result.items.filter((inv) => inv.customerId === partner.id);
          const invoices = forCustomer.filter(
            (inv) => inv.kind !== 'quote' && inv.status === 'posted',
          );
          const quotes = forCustomer.filter((inv) => inv.kind === 'quote');

          let due = 0;
          for (const invoice of invoices) {
            if (paymentState(invoice) !== 'paid') {
              due += dueFor(invoice);
            }
          }

          this.invoiceCount.set(invoices.length);
          this.invoiceDue.set(roundMoney(due, this.currency()));
          this.quoteCount.set(quotes.length);
        });
    }

    if (this.hasModule('purchases') && partner.isSupplier) {
      this.purchaseService
        .getOrders({ page: 0, size: 500 })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => {
          const mine = result.items.filter(
            (order) => order.supplierId === partner.id && order.status !== 'cancelled',
          );
          let total = 0;
          for (const order of mine) {
            total += purchaseTotals(order.lines, this.currency()).totalTtc;
          }
          this.purchaseCount.set(mine.length);
          this.purchaseTotal.set(roundMoney(total, this.currency()));
        });
    }

    if (this.hasModule('products') && partner.isSupplier) {
      this.productService
        .getProducts({ page: 0, size: 500, active: true })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((result) => {
          const mine = result.items.filter((product) =>
            product.suppliers.some((entry) => entry.supplierId === partner.id),
          );
          this.productCount.set(mine.length);
        });
    }
  }
}

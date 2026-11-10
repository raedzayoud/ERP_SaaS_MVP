import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { formatMoney } from '../../../../shared/utils/money';
import { MarketingPromotion } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-promotion-list',
  imports: [ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './promotion-list.html',
  styleUrl: './promotion-list.css',
})
export class PromotionList {
  private readonly api = inject(MarketingApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tenant = inject(TenantService);
  readonly permissions = inject(PermissionService);

  readonly currency = this.tenant.activeCurrency();
  promotions = signal<MarketingPromotion[]>([]);
  loading = signal(true);
  loadFailed = signal(false);
  notice = signal('');
  noticeError = signal(false);
  search = signal('');
  activeFilter = signal('');
  searchControl = new FormControl('', { nonNullable: true });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        this.search.set(value);
        this.load();
      });

    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const active =
      this.activeFilter() === '' ? undefined : this.activeFilter() === 'active';

    this.api
      .getPromotions(this.search() || undefined, active)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (promotions) => {
          this.promotions.set(promotions);
          this.loading.set(false);
        },
        error: () => {
          this.loadFailed.set(true);
          this.loading.set(false);
        },
      });
  }

  onActiveFilter(event: Event): void {
    this.activeFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  delete(promotion: MarketingPromotion): void {
    if (!window.confirm(this.transloco.translate('marketing.promotions.deleteConfirm'))) {
      return;
    }

    this.api
      .deletePromotion(promotion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('marketing.promotions.deleted');
          this.load();
        },
        error: () => this.showNotice('marketing.promotions.loadError', true),
      });
  }

  discountLabel(promotion: MarketingPromotion): string {
    if (promotion.discountType === 'percentage') {
      return `${promotion.discountValue}%`;
    }
    return this.money(promotion.discountValue);
  }

  money(value: number): string {
    return formatMoney(value, this.currency, this.transloco.getActiveLang());
  }

  statusClass(active: boolean): string {
    return active ? 'badge badge-success' : 'badge badge-warning';
  }

  private showNotice(key: string, error = false): void {
    this.notice.set(key);
    this.noticeError.set(error);
    setTimeout(() => this.notice.set(''), 4000);
  }
}

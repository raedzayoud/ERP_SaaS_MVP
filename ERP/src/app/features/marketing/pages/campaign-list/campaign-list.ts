import { CurrencyPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { PermissionService } from '../../../../core/services/permission.service';
import { MarketingCampaign } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-campaign-list',
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink, TranslocoDirective],
  templateUrl: './campaign-list.html',
  styleUrl: './campaign-list.css',
})
export class CampaignList {
  private readonly api = inject(MarketingApiService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permissions = inject(PermissionService);

  campaigns = signal<MarketingCampaign[]>([]);
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
      .getCampaigns(this.search() || undefined, active)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (campaigns) => {
          this.campaigns.set(campaigns);
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

  delete(campaign: MarketingCampaign): void {
    if (!window.confirm(this.transloco.translate('marketing.campaigns.deleteConfirm'))) {
      return;
    }

    this.api
      .deleteCampaign(campaign.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showNotice('marketing.campaigns.deleted');
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          this.showNotice(
            error.status === 409
              ? 'marketing.campaigns.deleteBlocked'
              : 'marketing.campaigns.loadError',
            true,
          );
        },
      });
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

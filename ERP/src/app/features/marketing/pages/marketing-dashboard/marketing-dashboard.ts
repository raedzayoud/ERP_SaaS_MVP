import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { MarketingDashboard } from '../../models/marketing';
import { MarketingApiService } from '../../services/marketing-api.service';

@Component({
  selector: 'app-marketing-dashboard',
  imports: [CurrencyPipe, RouterLink, TranslocoDirective],
  templateUrl: './marketing-dashboard.html',
  styleUrl: './marketing-dashboard.css',
})
export class MarketingDashboardPage {
  private readonly api = inject(MarketingApiService);

  dashboard = signal<MarketingDashboard | null>(null);
  loading = signal(true);
  loadFailed = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api.getDashboard().subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.loading.set(false);
      },
      error: () => {
        this.loadFailed.set(true);
        this.loading.set(false);
      },
    });
  }
}

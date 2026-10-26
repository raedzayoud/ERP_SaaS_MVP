import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { PlatformService } from '../../services/platform.service';
import { PlatformStats, PlatformTenant } from '../../models/platform';
import { getPlanById } from '../../../../core/data/plans';

@Component({
  selector: 'app-admin-home',
  imports: [CurrencyPipe, DatePipe, RouterLink, TranslocoDirective],
  templateUrl: './admin-home.html',
  styleUrl: './admin-home.css',
})
export class AdminHome {
  private readonly platformService = inject(PlatformService);

  stats = signal<PlatformStats | null>(null);
  recentTenants = signal<PlatformTenant[]>([]);
  loading = signal(true);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);

    this.platformService.getStats().subscribe((stats) => {
      this.stats.set(stats);
      this.loading.set(false);
    });

    this.platformService.getTenants().subscribe((tenants) => {
      this.recentTenants.set(
        [...tenants].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
      );
    });
  }

  planName(planId: string): string {
    return getPlanById(planId).name;
  }

  statusClass(status: string): string {
    if (status === 'active') return 'status-active';
    if (status === 'trial') return 'status-trial';
    return 'status-suspended';
  }
}

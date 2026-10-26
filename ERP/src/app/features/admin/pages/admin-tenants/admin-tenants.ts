import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { PlatformService } from '../../services/platform.service';
import { PlatformTenant } from '../../models/platform';
import { getPlanById } from '../../../../core/data/plans';

@Component({
  selector: 'app-admin-tenants',
  imports: [DatePipe, TranslocoDirective],
  templateUrl: './admin-tenants.html',
  styleUrl: './admin-tenants.css',
})
export class AdminTenants {
  private readonly platformService = inject(PlatformService);

  tenants = signal<PlatformTenant[]>([]);
  loading = signal(true);
  updatingId = signal<number | null>(null);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.platformService.getTenants().subscribe((tenants) => {
      this.tenants.set(tenants);
      this.loading.set(false);
    });
  }

  toggleStatus(tenant: PlatformTenant): void {
    this.updatingId.set(tenant.id);
    this.platformService.toggleStatus(tenant.id).subscribe((updated) => {
      if (updated) {
        this.tenants.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
      }
      this.updatingId.set(null);
    });
  }

  planOf(tenant: PlatformTenant) {
    return getPlanById(tenant.planId);
  }

  statusClass(status: string): string {
    if (status === 'active') return 'status-active';
    if (status === 'trial') return 'status-trial';
    return 'status-suspended';
  }
}

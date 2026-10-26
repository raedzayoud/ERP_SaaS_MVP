import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../../../core/services/tenant.service';
import { PermissionService } from '../../../../core/services/permission.service';
import { ERP_APPS } from '../../../../core/data/apps';

interface AppTile {
  id: string;
  label: string;
  icon: string;
  description: string;
  route: string;
}

const APP_ROUTES: Record<string, string> = {
  dashboard: '/dashboard',
  contacts: '/contacts',
  products: '/products',
  sales: '/sales-orders',
  invoices: '/invoices',
  payments: '/payments',
  purchases: '/purchases',
  stock: '/stock',
  accounting: '/accounting',
  invoicing: '/invoicing',
  reports: '/reports',
  'ai-assistant': '/ai-assistant',
};

@Component({
  selector: 'app-apps',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './apps.html',
  styleUrl: './apps.css',
})
export class Apps {
  private readonly tenantService = inject(TenantService);
  private readonly permissions = inject(PermissionService);

  readonly tiles = computed<AppTile[]>(() => {
    const enabled = this.tenantService.enabledModules();
    const canSeeDashboard = this.permissions.canAccessModule('dashboard');

    return ERP_APPS.filter((app) => app.id === 'dashboard' || enabled.includes(app.id))
      // Hide the dashboard tile for roles that cannot open the dashboard page.
      .filter((app) => app.id !== 'dashboard' || canSeeDashboard)
      .filter((app) => APP_ROUTES[app.id] !== undefined)
      .map((app) => ({
        id: app.id,
        label: app.label,
        icon: app.icon,
        description: app.description,
        route: APP_ROUTES[app.id],
      }));
  });
}

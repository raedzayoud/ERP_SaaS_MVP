import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../core/services/tenant.service';

interface MenuItem {
  labelKey: string;
  icon: string;
  route: string;
  moduleId: string;
}

interface MenuSection {
  titleKey: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, TranslocoDirective],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private tenantService = inject(TenantService);

  collapsed = input<boolean>(false);
  mobileOpen = input<boolean>(false);
  closeMobile = output<void>();

  private allSections: MenuSection[] = [
    {
      titleKey: 'sidebar.sections.general',
      items: [
        {
          labelKey: 'sidebar.items.dashboard',
          icon: '📊',
          route: '/dashboard',
          moduleId: 'dashboard',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.relationship',
      items: [
        {
          labelKey: 'sidebar.items.contacts',
          icon: '👥',
          route: '/contacts',
          moduleId: 'contacts',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.sales',
      items: [
        {
          labelKey: 'sidebar.items.products',
          icon: '📦',
          route: '/products',
          moduleId: 'products',
        },
        {
          labelKey: 'sidebar.items.invoices',
          icon: '🧾',
          route: '/invoices',
          moduleId: 'invoices',
        },
        {
          labelKey: 'sidebar.items.quotes',
          icon: '📋',
          route: '/quotes',
          moduleId: 'invoices',
        },
        {
          labelKey: 'sidebar.items.payments',
          icon: '💳',
          route: '/payments',
          moduleId: 'payments',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.purchases',
      items: [
        {
          labelKey: 'sidebar.items.purchaseOrders',
          icon: '🛒',
          route: '/purchases',
          moduleId: 'purchases',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.inventory',
      items: [{ labelKey: 'sidebar.items.stock', icon: '🏬', route: '/stock', moduleId: 'stock' }],
    },
    {
      titleKey: 'sidebar.sections.finance',
      items: [
        {
          labelKey: 'sidebar.items.accounting',
          icon: '📒',
          route: '/accounting',
          moduleId: 'accounting',
        },
        {
          labelKey: 'sidebar.items.invoicing',
          icon: '📄',
          route: '/invoicing',
          moduleId: 'invoicing',
        },
        { labelKey: 'sidebar.items.reports', icon: '📈', route: '/reports', moduleId: 'reports' },
      ],
    },
    {
      titleKey: 'sidebar.sections.tools',
      items: [
        {
          labelKey: 'sidebar.items.aiAssistant',
          icon: '🤖',
          route: '/ai-assistant',
          moduleId: 'ai-assistant',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.workspace',
      items: [
        {
          labelKey: 'sidebar.items.settings',
          icon: '⚙️',
          route: '/settings',
          moduleId: 'settings',
        },
      ],
    },
  ];

  get menuSections(): MenuSection[] {
    const enabled = this.tenantService.enabledModules();

    return this.allSections
      .map((section) => ({
        ...section,
        items: section.items.filter(
          (item) =>
            item.moduleId === 'dashboard' ||
            item.moduleId === 'settings' ||
            enabled.includes(item.moduleId),
        ),
      }))
      .filter((section) => section.items.length > 0);
  }

  onLinkClick(): void {
    this.closeMobile.emit();
  }
}

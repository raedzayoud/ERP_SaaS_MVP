import { Component, inject, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../core/services/tenant.service';
import { PermissionService } from '../../core/services/permission.service';

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
  private permissions = inject(PermissionService);

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
        {
          labelKey: 'sidebar.items.leads',
          icon: '🧭',
          route: '/leads',
          moduleId: 'contacts',
        },
        {
          labelKey: 'sidebar.items.opportunities',
          icon: '🤝',
          route: '/opportunities',
          moduleId: 'contacts',
        },
        {
          labelKey: 'sidebar.items.reminders',
          icon: '🔔',
          route: '/reminders',
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
          labelKey: 'sidebar.items.salesOrders',
          icon: '📑',
          route: '/sales-orders',
          moduleId: 'sales',
        },
        {
          labelKey: 'sidebar.items.deliveries',
          icon: '🚚',
          route: '/deliveries',
          moduleId: 'sales',
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
        {
          labelKey: 'sidebar.items.supplierBills',
          icon: '🧾',
          route: '/supplier-bills',
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
        {
          labelKey: 'sidebar.items.analytics',
          icon: '📊',
          route: '/analytics',
          moduleId: 'reports',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.hr',
      items: [
        {
          labelKey: 'sidebar.items.hrDashboard',
          icon: '🧑‍💼',
          route: '/hr',
          moduleId: 'hr',
        },
        {
          labelKey: 'sidebar.items.employees',
          icon: '👤',
          route: '/hr/employees',
          moduleId: 'hr',
        },
        {
          labelKey: 'sidebar.items.leave',
          icon: '🌴',
          route: '/hr/leave',
          moduleId: 'hr',
        },
      ],
    },
    {
      titleKey: 'sidebar.sections.support',
      items: [
        {
          labelKey: 'sidebar.items.supportDashboard',
          icon: '🎧',
          route: '/support',
          moduleId: 'support',
        },
        {
          labelKey: 'sidebar.items.tickets',
          icon: '🎫',
          route: '/support/tickets',
          moduleId: 'support',
        },
        {
          labelKey: 'sidebar.items.knowledgeBase',
          icon: '📚',
          route: '/support/knowledge-base',
          moduleId: 'support',
        },
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
      titleKey: 'sidebar.sections.collaboration',
      items: [
        {
          labelKey: 'sidebar.items.rooms',
          icon: '💬',
          route: '/rooms',
          moduleId: 'collab',
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
        items: section.items.filter((item) => {
          if (!this.permissions.canAccessModule(item.moduleId)) {
            return false;
          }
          // The BI page is reserved to the finance roles,
          // even commercial and acheteur who have the reports module.
          if (
            item.route === '/analytics' &&
            !this.permissions.hasAnyRole(['admin-entreprise', 'directeur', 'comptable'])
          ) {
            return false;
          }
          // Dashboard, Apps and Settings are workspace tools,
          // not parts of the purchased module list.
          const isWorkspaceTool =
            item.moduleId === 'dashboard' ||
            item.moduleId === 'apps' ||
            item.moduleId === 'settings';
          return isWorkspaceTool || enabled.includes(item.moduleId);
        }),
      }))
      .filter((section) => section.items.length > 0);
  }

  onLinkClick(): void {
    this.closeMobile.emit();
  }
}

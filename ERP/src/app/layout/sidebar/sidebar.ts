import { Component, input, output, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TenantService } from '../../core/services/tenant.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  moduleId: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
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
      title: 'General',
      items: [
        { label: 'Dashboard', icon: '📊', route: '/dashboard', moduleId: 'dashboard' },
      ],
    },
    {
      title: 'Relationship',
      items: [
        { label: 'Contacts', icon: '👥', route: '/contacts', moduleId: 'contacts' },
      ],
    },
    {
      title: 'Sales',
      items: [
        { label: 'Products', icon: '📦', route: '/products', moduleId: 'products' },
        { label: 'Invoices', icon: '🧾', route: '/invoices', moduleId: 'invoices' },
        { label: 'Payments', icon: '💳', route: '/payments', moduleId: 'payments' },
      ],
    },
    {
      title: 'Purchases',
      items: [
        { label: 'Purchase Orders', icon: '🛒', route: '/purchases', moduleId: 'purchases' },
      ],
    },
    {
      title: 'Inventory',
      items: [
        { label: 'Stock', icon: '🏬', route: '/stock', moduleId: 'stock' },
      ],
    },
    {
      title: 'Finance',
      items: [
        { label: 'Accounting', icon: '📒', route: '/accounting', moduleId: 'accounting' },
        { label: 'Invoicing', icon: '📄', route: '/invoicing', moduleId: 'invoicing' },
        { label: 'Reports', icon: '📈', route: '/reports', moduleId: 'reports' },
      ],
    },
    {
      title: 'Tools',
      items: [
        { label: 'AI Assistant', icon: '🤖', route: '/ai-assistant', moduleId: 'ai-assistant' },
      ],
    },
    {
      title: 'Workspace',
      items: [
        { label: 'Settings', icon: '⚙️', route: '/settings', moduleId: 'settings' },
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

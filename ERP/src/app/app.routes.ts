import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { moduleGuard } from './core/guards/module.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/pages/signup/signup').then((m) => m.SignupComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-home/dashboard-home').then(
            (m) => m.DashboardHome,
          ),
        data: { title: 'Dashboard', moduleId: 'dashboard' },
      },
      {
        path: 'contacts',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Contacts',
          description: 'Manage your contacts, companies, leads, and opportunities. Track interactions and build your CRM pipeline.',
          icon: '👥',
          moduleId: 'contacts',
        },
      },
      {
        path: 'products',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Products',
          description: 'Manage your product and service catalog. Set prices, categories, taxes, and stock levels.',
          icon: '📦',
          moduleId: 'products',
        },
      },
      {
        path: 'invoices',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Sales Invoices',
          description: 'Create and manage sales invoices. Track payments, send reminders, and generate PDFs.',
          icon: '🧾',
          moduleId: 'invoices',
        },
      },
      {
        path: 'payments',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Payments',
          description: 'Track incoming and outgoing payments. Reconcile bank statements and manage payment methods.',
          icon: '💳',
          moduleId: 'payments',
        },
      },
      {
        path: 'purchases',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Purchase Orders',
          description: 'Manage suppliers, purchase orders, and receipts. Track procurement from request to delivery.',
          icon: '🛒',
          moduleId: 'purchases',
        },
      },
      {
        path: 'stock',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Stock',
          description: 'Monitor inventory levels across warehouses. Manage stock movements, transfers, and adjustments.',
          icon: '🏬',
          moduleId: 'stock',
        },
      },
      {
        path: 'accounting',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Accounting',
          description: 'Manage journals, general ledger, trial balance, and financial statements. Double-entry bookkeeping.',
          icon: '📒',
          moduleId: 'accounting',
        },
      },
      {
        path: 'invoicing',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Invoicing',
          description: 'Configure invoicing settings, numbering sequences, tax rules, and electronic invoicing compliance.',
          icon: '📄',
          moduleId: 'invoicing',
        },
      },
      {
        path: 'reports',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'Reports',
          description: 'View business analytics and reports. Export to PDF, Excel, and CSV. Track KPIs and trends.',
          icon: '📈',
          moduleId: 'reports',
        },
      },
      {
        path: 'ai-assistant',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./shared/components/module-placeholder/module-placeholder').then(
            (m) => m.ModulePlaceholder,
          ),
        data: {
          title: 'AI Assistant',
          description: 'Ask questions about your documents, extract data from invoices, and get AI-powered insights.',
          icon: '🤖',
          moduleId: 'ai-assistant',
        },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings/settings').then(
            (m) => m.SettingsComponent,
          ),
        data: { title: 'Settings' },
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./shared/pages/not-found/not-found').then((m) => m.NotFoundComponent),
  },
];

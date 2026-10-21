import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { moduleGuard } from './core/guards/module.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./features/auth/pages/signup/signup').then((m) => m.SignupComponent),
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-home/dashboard-home').then(
            (m) => m.DashboardHome,
          ),
        data: { title: 'titles.dashboard', moduleId: 'dashboard' },
      },
      {
        path: 'contacts/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/contact-form/contact-form').then((m) => m.ContactForm),
        data: { title: 'titles.newContact', moduleId: 'contacts' },
      },
      {
        path: 'contacts/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/contact-form/contact-form').then((m) => m.ContactForm),
        data: { title: 'titles.editContact', moduleId: 'contacts' },
      },
      {
        path: 'contacts',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/contacts/contacts').then((m) => m.Contacts),
        data: {
          title: 'titles.contacts',
          description: 'descriptions.contacts',
          icon: '👥',
          moduleId: 'contacts',
        },
      },
      {
        path: 'products/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/products/pages/product-form/product-form').then((m) => m.ProductForm),
        data: { title: 'titles.newProduct', moduleId: 'products' },
      },
      {
        path: 'products/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/products/pages/product-form/product-form').then((m) => m.ProductForm),
        data: { title: 'titles.editProduct', moduleId: 'products' },
      },
      {
        path: 'products',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/products/pages/products/products').then((m) => m.Products),
        data: {
          title: 'titles.products',
          description: 'descriptions.products',
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
          title: 'titles.invoices',
          description: 'descriptions.invoices',
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
          title: 'titles.payments',
          description: 'descriptions.payments',
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
          title: 'titles.purchases',
          description: 'descriptions.purchases',
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
          title: 'titles.stock',
          description: 'descriptions.stock',
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
          title: 'titles.accounting',
          description: 'descriptions.accounting',
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
          title: 'titles.invoicing',
          description: 'descriptions.invoicing',
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
          title: 'titles.reports',
          description: 'descriptions.reports',
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
          title: 'titles.ai-assistant',
          description: 'descriptions.ai-assistant',
          icon: '🤖',
          moduleId: 'ai-assistant',
        },
      },
      {
        path: 'module-inactive',
        loadComponent: () =>
          import('./shared/pages/module-inactive/module-inactive').then((m) => m.ModuleInactive),
        data: { title: 'titles.moduleInactive' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/pages/settings/settings').then((m) => m.SettingsComponent),
        data: { title: 'titles.settings' },
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

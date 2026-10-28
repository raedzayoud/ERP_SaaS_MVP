import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { moduleGuard } from './core/guards/module.guard';
import { guestGuard, roleGuard } from './core/guards/role.guard';
import { TENANT_ROLES } from './core/models/role';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'login/:role',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login-credentials/login-credentials').then(
        (m) => m.LoginCredentials,
      ),
  },
  {
    path: 'login/email',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login-generic/login-generic').then((m) => m.LoginGeneric),
  },
  {
    path: 'renew-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/renew-password/renew-password').then((m) => m.RenewPassword),
  },
  {
    path: 'signup',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/signup/signup').then((m) => m.SignupComponent),
  },
  {
    path: 'signup/apps/:suite',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/signup/signup').then((m) => m.SignupComponent),
    data: { title: 'titles.signup' },
  },
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/pages/landing/landing').then((m) => m.Landing),
    data: { title: 'titles.landing' },
  },
  {
    path: 'portal',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['client-externe'] },
    loadComponent: () =>
      import('./layout/portal-layout/portal-layout').then((m) => m.PortalLayout),
    children: [
      {
        path: 'quotes/:id',
        loadComponent: () =>
          import('./features/portal/pages/portal-quote-detail/portal-quote-detail').then(
            (m) => m.PortalQuoteDetail,
          ),
        data: { title: 'portal.quoteDetail.title' },
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./features/portal/pages/portal-quotes/portal-quotes').then(
            (m) => m.PortalQuotes,
          ),
        data: { title: 'portal.quotes.title' },
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/portal/pages/portal-orders/portal-orders').then(
            (m) => m.PortalOrders,
          ),
        data: { title: 'portal.orders.title' },
      },
      {
        path: 'invoices/:id',
        loadComponent: () =>
          import('./features/portal/pages/portal-invoice-detail/portal-invoice-detail').then(
            (m) => m.PortalInvoiceDetail,
          ),
        data: { title: 'portal.detail.title' },
      },
      {
        path: 'invoices',
        loadComponent: () =>
          import('./features/portal/pages/portal-invoices/portal-invoices').then(
            (m) => m.PortalInvoices,
          ),
        data: { title: 'portal.invoices.title' },
      },
      { path: '', redirectTo: 'invoices', pathMatch: 'full' },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['super-admin'] },
    loadComponent: () => import('./layout/admin-layout/admin-layout').then((m) => m.AdminLayout),
    children: [
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/admin/pages/admin-tenants/admin-tenants').then(
            (m) => m.AdminTenants,
          ),
        data: { title: 'admin.nav.tenants' },
      },
      {
        path: 'plans',
        loadComponent: () =>
          import('./features/admin/pages/admin-plans/admin-plans').then((m) => m.AdminPlans),
        data: { title: 'admin.nav.plans' },
      },
      {
        path: '',
        loadComponent: () => import('./features/admin/pages/admin-home/admin-home').then((m) => m.AdminHome),
        data: { title: 'admin.nav.supervision' },
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard, roleGuard],
    data: { roles: TENANT_ROLES },
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
        path: 'apps',
        loadComponent: () => import('./features/apps/pages/apps/apps').then((m) => m.Apps),
        data: { title: 'titles.apps' },
      },
      {
        path: 'contacts/:id/overview',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/contact-overview/contact-overview').then(
            (m) => m.ContactOverview,
          ),
        data: { title: 'titles.contactOverview', moduleId: 'contacts' },
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
        path: 'leads/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/lead-form/lead-form').then((m) => m.LeadForm),
        data: { title: 'titles.newLead', moduleId: 'contacts' },
      },
      {
        path: 'leads/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/lead-form/lead-form').then((m) => m.LeadForm),
        data: { title: 'titles.editLead', moduleId: 'contacts' },
      },
      {
        path: 'leads',
        canActivate: [moduleGuard],
        loadComponent: () => import('./features/crm/pages/leads/leads').then((m) => m.Leads),
        data: {
          title: 'titles.leads',
          description: 'descriptions.leads',
          icon: '🧭',
          moduleId: 'contacts',
        },
      },
      {
        path: 'opportunities/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/opportunity-form/opportunity-form').then(
            (m) => m.OpportunityForm,
          ),
        data: { title: 'titles.newOpportunity', moduleId: 'contacts' },
      },
      {
        path: 'opportunities/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/opportunity-form/opportunity-form').then(
            (m) => m.OpportunityForm,
          ),
        data: { title: 'titles.editOpportunity', moduleId: 'contacts' },
      },
      {
        path: 'opportunities',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/opportunities/opportunities').then((m) => m.Opportunities),
        data: {
          title: 'titles.opportunities',
          description: 'descriptions.opportunities',
          icon: '🤝',
          moduleId: 'contacts',
        },
      },
      {
        path: 'reminders',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/crm/pages/reminders/reminders').then((m) => m.Reminders),
        data: {
          title: 'titles.reminders',
          description: 'descriptions.reminders',
          icon: '🔔',
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
        path: 'invoices/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-form/invoice-form').then((m) => m.InvoiceForm),
        data: { title: 'titles.newInvoice', moduleId: 'invoices' },
      },
      {
        path: 'invoices/:id/edit',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-form/invoice-form').then((m) => m.InvoiceForm),
        data: { title: 'titles.editInvoice', moduleId: 'invoices' },
      },
      {
        path: 'invoices/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-detail/invoice-detail').then(
            (m) => m.InvoiceDetail,
          ),
        data: { title: 'titles.invoiceDetail', moduleId: 'invoices' },
      },
      {
        path: 'invoices',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoices/invoices').then((m) => m.Invoices),
        data: {
          title: 'titles.invoices',
          description: 'descriptions.invoices',
          icon: '🧾',
          moduleId: 'invoices',
        },
      },
      {
        path: 'quotes/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-form/invoice-form').then((m) => m.InvoiceForm),
        data: { title: 'titles.newQuote', moduleId: 'invoices', kind: 'quote' },
      },
      {
        path: 'quotes/:id/edit',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-form/invoice-form').then((m) => m.InvoiceForm),
        data: { title: 'titles.editQuote', moduleId: 'invoices', kind: 'quote' },
      },
      {
        path: 'quotes/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoice-detail/invoice-detail').then(
            (m) => m.InvoiceDetail,
          ),
        data: { title: 'titles.quoteDetail', moduleId: 'invoices' },
      },
      {
        path: 'quotes',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/invoices/pages/invoices/invoices').then((m) => m.Invoices),
        data: {
          title: 'titles.quotes',
          description: 'descriptions.quotes',
          icon: '📋',
          moduleId: 'invoices',
          kind: 'quote',
        },
      },
      {
        path: 'sales-orders/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/sales-order-form/sales-order-form').then(
            (m) => m.SalesOrderForm,
          ),
        data: { title: 'titles.newSalesOrder', moduleId: 'sales' },
      },
      {
        path: 'sales-orders/:id/edit',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/sales-order-form/sales-order-form').then(
            (m) => m.SalesOrderForm,
          ),
        data: { title: 'titles.editSalesOrder', moduleId: 'sales' },
      },
      {
        path: 'sales-orders/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/sales-order-detail/sales-order-detail').then(
            (m) => m.SalesOrderDetail,
          ),
        data: { title: 'titles.salesOrderDetail', moduleId: 'sales' },
      },
      {
        path: 'sales-orders',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/sales-order-list/sales-order-list').then(
            (m) => m.SalesOrderList,
          ),
        data: {
          title: 'titles.salesOrders',
          description: 'descriptions.salesOrders',
          icon: '📑',
          moduleId: 'sales',
        },
      },
      {
        path: 'deliveries/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/delivery-form/delivery-form').then(
            (m) => m.DeliveryForm,
          ),
        data: { title: 'titles.newDelivery', moduleId: 'sales' },
      },
      {
        path: 'deliveries/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/delivery-detail/delivery-detail').then(
            (m) => m.DeliveryDetail,
          ),
        data: { title: 'titles.deliveryDetail', moduleId: 'sales' },
      },
      {
        path: 'deliveries',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/sales/pages/delivery-list/delivery-list').then(
            (m) => m.DeliveryList,
          ),
        data: {
          title: 'titles.deliveries',
          description: 'descriptions.deliveries',
          icon: '🚚',
          moduleId: 'sales',
        },
      },
      {
        path: 'payments/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/payments/pages/payment-form/payment-form').then((m) => m.PaymentForm),
        data: { title: 'titles.newPayment', moduleId: 'payments' },
      },
      {
        path: 'payments/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/payments/pages/payment-detail/payment-detail').then(
            (m) => m.PaymentDetail,
          ),
        data: { title: 'titles.paymentDetail', moduleId: 'payments' },
      },
      {
        path: 'payments',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/payments/pages/payments/payments').then((m) => m.Payments),
        data: {
          title: 'titles.payments',
          description: 'descriptions.payments',
          icon: '💳',
          moduleId: 'payments',
        },
      },
      {
        path: 'purchases/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/purchase-form/purchase-form').then(
            (m) => m.PurchaseForm,
          ),
        data: { title: 'titles.newPurchaseOrder', moduleId: 'purchases' },
      },
      {
        path: 'supplier-bills/new',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/supplier-bill-form/supplier-bill-form').then(
            (m) => m.SupplierBillForm,
          ),
        data: { title: 'titles.newSupplierBill', moduleId: 'purchases' },
      },
      {
        path: 'supplier-bills/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/supplier-bill-detail/supplier-bill-detail').then(
            (m) => m.SupplierBillDetail,
          ),
        data: { title: 'titles.supplierBillDetail', moduleId: 'purchases' },
      },
      {
        path: 'supplier-bills',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/supplier-bills/supplier-bills').then(
            (m) => m.SupplierBills,
          ),
        data: {
          title: 'titles.supplierBills',
          description: 'descriptions.supplierBills',
          moduleId: 'purchases',
        },
      },
      {
        path: 'purchases/:id/receive',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/purchase-receive/purchase-receive').then(
            (m) => m.PurchaseReceive,
          ),
        data: { title: 'titles.receiveOrder', moduleId: 'purchases' },
      },
      {
        path: 'purchases/:id/edit',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/purchase-form/purchase-form').then(
            (m) => m.PurchaseForm,
          ),
        data: { title: 'titles.editPurchaseOrder', moduleId: 'purchases' },
      },
      {
        path: 'purchases/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/purchase-detail/purchase-detail').then(
            (m) => m.PurchaseDetail,
          ),
        data: { title: 'titles.purchaseOrderDetail', moduleId: 'purchases' },
      },
      {
        path: 'purchases',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/purchases/pages/purchases/purchases').then((m) => m.Purchases),
        data: {
          title: 'titles.purchases',
          description: 'descriptions.purchases',
          icon: '🛒',
          moduleId: 'purchases',
        },
      },
      {
        path: 'stock/warehouses',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/stock/pages/warehouses/warehouses').then((m) => m.Warehouses),
        data: { title: 'titles.stockWarehouses', moduleId: 'stock' },
      },
      {
        path: 'stock/movements',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/stock/pages/stock-movements/stock-movements').then(
            (m) => m.StockMovements,
          ),
        data: { title: 'titles.stockMovements', moduleId: 'stock' },
      },
      {
        path: 'stock/adjustment',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/stock/pages/stock-adjustment/stock-adjustment').then(
            (m) => m.StockAdjustment,
          ),
        data: { title: 'titles.stockAdjustment', moduleId: 'stock' },
      },
      {
        path: 'stock/transfer',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/stock/pages/stock-transfer/stock-transfer').then(
            (m) => m.StockTransfer,
          ),
        data: { title: 'titles.stockTransfer', moduleId: 'stock' },
      },
      {
        path: 'stock',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/stock/pages/stock-list/stock-list').then((m) => m.StockList),
        data: {
          title: 'titles.stock',
          description: 'descriptions.stock',
          icon: '🏬',
          moduleId: 'stock',
        },
      },
      {
        path: 'accounting/entries/:id',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/accounting/pages/journal-entry-detail/journal-entry-detail').then(
            (m) => m.JournalEntryDetail,
          ),
        data: { title: 'titles.journalEntryDetail', moduleId: 'accounting' },
      },
      {
        path: 'accounting/accounts',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/accounting/pages/chart-of-accounts/chart-of-accounts').then(
            (m) => m.ChartOfAccounts,
          ),
        data: { title: 'titles.chartOfAccounts', moduleId: 'accounting' },
      },
      {
        path: 'accounting',
        canActivate: [moduleGuard],
        loadComponent: () =>
          import('./features/accounting/pages/journal-entries/journal-entries').then(
            (m) => m.JournalEntries,
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
          import('./features/invoicing/pages/invoicing-settings/invoicing-settings').then(
            (m) => m.InvoicingSettingsPage,
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
          import('./features/reports/pages/reports/reports').then((m) => m.Reports),
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
        canActivate: [roleGuard],
        loadComponent: () =>
          import('./features/settings/pages/settings/settings').then((m) => m.SettingsComponent),
        data: { title: 'titles.settings', roles: ['admin-entreprise'] },
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
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/pages/not-found/not-found').then((m) => m.NotFoundComponent),
  },
];

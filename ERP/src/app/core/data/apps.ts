export interface ErpApp {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  dependencies: string[];
}

export const ERP_APPS: ErpApp[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '📊',
    description: 'KPIs, activity feed, and quick actions',
    category: 'General',
    dependencies: [],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    icon: '👥',
    description: 'Contacts, companies, leads, and opportunities',
    category: 'Relationship',
    dependencies: [],
  },
  {
    id: 'products',
    label: 'Products',
    icon: '📦',
    description: 'Product and service catalog with prices',
    category: 'Sales',
    dependencies: [],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: '🧾',
    description: 'Create and manage sales invoices',
    category: 'Sales',
    dependencies: ['contacts', 'products'],
  },
  {
    id: 'payments',
    label: 'Payments',
    icon: '💳',
    description: 'Track incoming and outgoing payments',
    category: 'Sales',
    dependencies: ['invoices'],
  },
  {
    id: 'purchases',
    label: 'Purchase Orders',
    icon: '🛒',
    description: 'Suppliers, purchase orders, and receipts',
    category: 'Purchases',
    dependencies: ['contacts', 'products'],
  },
  {
    id: 'stock',
    label: 'Stock',
    icon: '🏬',
    description: 'Warehouses, stock movements, and inventory',
    category: 'Inventory',
    dependencies: ['products'],
  },
  {
    id: 'accounting',
    label: 'Accounting',
    icon: '📒',
    description: 'Journals, ledger, balance, and financial reports',
    category: 'Finance',
    dependencies: ['invoices', 'purchases'],
  },
  {
    id: 'invoicing',
    label: 'Invoicing Settings',
    icon: '📄',
    description: 'Numbering, taxes, and e-invoicing compliance',
    category: 'Finance',
    dependencies: ['invoices'],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: '📈',
    description: 'Business analytics with PDF/Excel/CSV export',
    category: 'Finance',
    dependencies: [],
  },
  {
    id: 'ai-assistant',
    label: 'AI Assistant',
    icon: '🤖',
    description: 'RAG chatbot and invoice extraction',
    category: 'Tools',
    dependencies: [],
  },
];

export function getAppById(id: string): ErpApp | undefined {
  return ERP_APPS.find((a) => a.id === id);
}

export function getAppsByCategory(): { category: string; apps: ErpApp[] }[] {
  const categories: { category: string; apps: ErpApp[] }[] = [];
  for (const app of ERP_APPS) {
    let group = categories.find((c) => c.category === app.category);
    if (!group) {
      group = { category: app.category, apps: [] };
      categories.push(group);
    }
    group.apps.push(app);
  }
  return categories;
}

/**
 * Returns the list of apps that must be added because they are
 * dependencies (direct or transitive) of the given app.
 */
export function resolveDependencies(appId: string, alreadySelected: string[]): string[] {
  const toAdd: string[] = [];
  const app = getAppById(appId);
  if (!app) return toAdd;

  const visit = (id: string) => {
    if (alreadySelected.includes(id) || toAdd.includes(id) || id === appId) return;
    const target = getAppById(id);
    if (!target) return;
    toAdd.push(id);
    for (const dep of target.dependencies) {
      visit(dep);
    }
  };

  for (const dep of app.dependencies) {
    visit(dep);
  }
  return toAdd;
}

/**
 * Returns apps that must be removed because they depend on the given app.
 */
export function resolveDependents(appId: string, selected: string[]): string[] {
  const toRemove: string[] = [];
  const visit = (id: string) => {
    if (toRemove.includes(id) || id === appId) return;
    const dependents = ERP_APPS.filter(
      (a) => a.dependencies.includes(id) && selected.includes(a.id),
    );
    for (const d of dependents) {
      toRemove.push(d.id);
      visit(d.id);
    }
  };
  visit(appId);
  return toRemove;
}

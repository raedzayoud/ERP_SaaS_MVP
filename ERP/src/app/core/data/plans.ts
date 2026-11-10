import { Plan } from '../models/plan';

export function getAllPlans(): Plan[] {
  return PLANS;
}

export const PLANS: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    priceMonthly: 29,
    priceAnnual: 278,
    maxUsers: 3,
    storageGb: 1,
    aiQuota: 0,
    modules: ['dashboard', 'contacts', 'products', 'sales', 'invoices', 'payments', 'collab'],
    features: [
      'Up to 3 users',
      '1 GB storage',
      'CRM & Contacts',
      'Product catalog',
      'Invoicing & Payments',
      'Rooms live included',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    priceMonthly: 79,
    priceAnnual: 758,
    maxUsers: 15,
    storageGb: 10,
    aiQuota: 100,
    modules: [
      'dashboard',
      'contacts',
      'products',
      'sales',
      'invoices',
      'payments',
      'purchases',
      'stock',
      'accounting',
      'invoicing',
      'reports',
      'collab',
      'hr',
      'support',
      'marketing',
    ],
    features: [
      'Up to 15 users',
      '10 GB storage',
      'Everything in Starter',
      'Purchases & Stock',
      'Accounting & Reports',
      'HR & Support',
      'Marketing & promotions',
      '100 AI queries/month',
      'Rooms live included',
      'Priority support',
    ],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 199,
    priceAnnual: 1910,
    maxUsers: 999,
    storageGb: 100,
    aiQuota: 1000,
    modules: [
      'dashboard',
      'contacts',
      'products',
      'sales',
      'invoices',
      'payments',
      'purchases',
      'stock',
      'accounting',
      'invoicing',
      'reports',
      'ai-assistant',
      'room-live',
      'collab',
      'hr',
      'support',
      'marketing',
    ],
    features: [
      'Unlimited users',
      '100 GB storage',
      'Everything in Business',
      'HR & Support',
      'AI Assistant (RAG)',
      '1,000 AI queries/month',
      'Advanced analytics',
      'Rooms live included',
      'Dedicated support',
      'Custom integrations',
    ],
  },
];

export function getPlanById(id: string): Plan {
  return PLANS.find((p) => p.id === id) || PLANS[0];
}

/**
 * Returns the cheapest plan that includes ALL of the given modules.
 * Used to auto-derive the user's plan from their app selection.
 */
export function getPlanForModules(modules: string[]): Plan {
  const unique = [...new Set(modules)];
  const matching = PLANS.filter((plan) =>
    unique.every((m) => plan.modules.includes(m)),
  );
  if (matching.length > 0) {
    const cheapest = matching.reduce((cheapest, p) =>
      p.priceMonthly < cheapest.priceMonthly ? p : cheapest,
    );
    return cheapest;
  }
  return PLANS[0];
}

import { Plan } from '../models/plan';

/** localStorage key holding the price overrides made by the super-admin. */
const PLAN_PRICE_KEY = 'erp_plan_prices';

type PlanPricePatch = Partial<Pick<Plan, 'priceMonthly' | 'priceAnnual'>>;

/** Reads the stored price overrides. Never throws (mock app + test runner). */
function loadPlanPriceOverrides(): Record<string, PlanPricePatch> {
  try {
    const raw = localStorage.getItem(PLAN_PRICE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Returns the given plan with the stored price overrides applied. */
export function applyPlanPriceOverrides(plan: Plan): Plan {
  const patch = loadPlanPriceOverrides()[plan.id];
  if (!patch) return plan;
  return {
    ...plan,
    priceMonthly:
      typeof patch.priceMonthly === 'number' ? patch.priceMonthly : plan.priceMonthly,
    priceAnnual: typeof patch.priceAnnual === 'number' ? patch.priceAnnual : plan.priceAnnual,
  };
}

/** Stores (or removes with null) the price override of one plan. */
export function savePlanPriceOverride(id: string, patch: PlanPricePatch | null): void {
  try {
    const overrides = loadPlanPriceOverrides();
    if (patch) {
      overrides[id] = { ...overrides[id], ...patch };
    } else {
      delete overrides[id];
    }
    localStorage.setItem(PLAN_PRICE_KEY, JSON.stringify(overrides));
  } catch {
    // mock app: ignore storage issues
  }
}

/** Removes every stored price override (back to the default PLANS). */
export function clearPlanPriceOverrides(): void {
  try {
    localStorage.removeItem(PLAN_PRICE_KEY);
  } catch {
    // mock app: ignore storage issues
  }
}

/** All plans with the super-admin price overrides applied. */
export function getAllPlans(): Plan[] {
  return PLANS.map(applyPlanPriceOverrides);
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
    modules: ['dashboard', 'contacts', 'products', 'sales', 'invoices', 'payments'],
    features: [
      'Up to 3 users',
      '1 GB storage',
      'CRM & Contacts',
      'Product catalog',
      'Invoicing & Payments',
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
    ],
    features: [
      'Up to 15 users',
      '10 GB storage',
      'Everything in Starter',
      'Purchases & Stock',
      'Accounting & Reports',
      '100 AI queries/month',
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
    ],
    features: [
      'Unlimited users',
      '100 GB storage',
      'Everything in Business',
      'AI Assistant (RAG)',
      '1,000 AI queries/month',
      'Advanced analytics',
      'Dedicated support',
      'Custom integrations',
    ],
  },
];

export function getPlanById(id: string): Plan {
  return applyPlanPriceOverrides(PLANS.find((p) => p.id === id) || PLANS[0]);
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
    return applyPlanPriceOverrides(cheapest);
  }
  return PLANS[0];
}

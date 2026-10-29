export type Role =
  | 'super-admin'
  | 'admin-entreprise'
  | 'commercial'
  | 'acheteur'
  | 'magasinier'
  | 'comptable'
  | 'directeur'
  | 'client-externe';

export const ALL_ROLES: Role[] = [
  'super-admin',
  'admin-entreprise',
  'commercial',
  'acheteur',
  'magasinier',
  'comptable',
  'directeur',
  'client-externe',
];

/** Roles that live inside a company workspace (everything except the platform super-admin). */
export const TENANT_ROLES: Role[] = [
  'admin-entreprise',
  'commercial',
  'acheteur',
  'magasinier',
  'comptable',
  'directeur',
  'client-externe',
];

/** Roles a company administrator can assign to a team member. */
export const ASSIGNEE_ROLES: Role[] = [
  'admin-entreprise',
  'commercial',
  'acheteur',
  'magasinier',
  'comptable',
  'directeur',
  'client-externe',
];

/** Every ERP module of the platform (the settings page maps them to permissions). */
export const ALL_MODULES = [
  'dashboard',
  'apps',
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
  'settings',
];

/**
 * Which ERP modules each role can open.
 * The sidebar and the role guard both use this map.
 */
export const ROLE_MODULE_ACCESS: Record<Role, string[]> = {
  'super-admin': [],
  'admin-entreprise': [...ALL_MODULES],
  commercial: [
    'dashboard',
    'apps',
    'contacts',
    'products',
    'sales',
    'invoices',
    'payments',
    'reports',
    'ai-assistant',
  ],
  acheteur: ['apps', 'contacts', 'products', 'purchases', 'reports'],
  magasinier: ['apps', 'products', 'stock'],
  comptable: [
    'apps',
    'invoices',
    'payments',
    'purchases',
    'accounting',
    'invoicing',
    'reports',
  ],
  directeur: [
    'dashboard',
    'apps',
    'reports',
    'sales',
    'invoices',
    'contacts',
    'purchases',
    'stock',
    'accounting',
  ],
  'client-externe': [],
};

export interface RoleInfo {
  role: Role;
  labelKey: string;
  descriptionKey: string;
  modules: string[];
}

export const ROLE_INFO: RoleInfo[] = ALL_ROLES.map((role) => ({
  role,
  labelKey: `roles.${role}.label`,
  descriptionKey: `roles.${role}.description`,
  modules: ROLE_MODULE_ACCESS[role],
}));

export function roleLabelKey(role: Role): string {
  return `roles.${role}.label`;
}

export function roleModules(role: Role): string[] {
  return ROLE_MODULE_ACCESS[role] ?? [];
}

const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  'super-admin': 'Super administrator',
  'admin-entreprise': 'Company administrator',
  commercial: 'Sales',
  acheteur: 'Purchaser',
  magasinier: 'Storekeeper',
  comptable: 'Accountant',
  directeur: 'Director',
  'client-externe': 'External client',
};

/** Plain display name for a role (used where a user name would normally appear). */
export function roleDisplayName(role: Role): string {
  return ROLE_DISPLAY_NAMES[role] ?? 'User';
}

export function isTenantRole(role: Role): boolean {
  return role !== 'super-admin';
}

/**
 * Dashboard route of each tenant role.
 * Admin-entreprise and directeur use the global dashboard; the other
 * actors each get their own role dashboard (see features/dashboard/pages).
 */
const DASHBOARD_BY_ROLE: Partial<Record<Role, string>> = {
  commercial: '/dashboard/sales',
  acheteur: '/dashboard/purchase',
  magasinier: '/dashboard/warehouse',
  comptable: '/dashboard/accounting',
};

/**
 * Where the user lands after signing in:
 * each tenant role gets its role dashboard (or the global one),
 * the platform super-admin goes to the console, the external
 * client to its portal.
 */
export function homeRouteForRole(role: Role): string {
  if (role === 'super-admin') return '/admin';
  if (role === 'client-externe') return '/portal/invoices';
  return DASHBOARD_BY_ROLE[role] ?? '/dashboard';
}

const LEGACY_ROLE_MAP: Record<string, Role> = {
  administrator: 'admin-entreprise',
  accountant: 'comptable',
  sales: 'commercial',
  viewer: 'commercial',
};

/** Converts a stored role string (including old mock values) into a valid Role. */
export function normalizeRole(value: string): Role {
  const legacy = LEGACY_ROLE_MAP[value.toLowerCase()];
  if (legacy) return legacy;
  if (ALL_ROLES.includes(value as Role)) return value as Role;
  return 'admin-entreprise';
}

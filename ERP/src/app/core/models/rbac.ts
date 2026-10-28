import { ALL_MODULES, Role } from './role';

/**
 * The six permission levels of the access-control engine.
 * Every module of a custom role has a set of these actions.
 */
export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'validate'
  | 'export';

export const ALL_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'update',
  'delete',
  'validate',
  'export',
];

export const PERMISSION_LABEL_KEYS: Record<PermissionAction, string> = {
  view: 'rbac.actions.view',
  create: 'rbac.actions.create',
  update: 'rbac.actions.update',
  delete: 'rbac.actions.delete',
  validate: 'rbac.actions.validate',
  export: 'rbac.actions.export',
};

/** moduleId -> allowed actions. A missing entry means "no access at all". */
export type ModulePermissions = Record<string, PermissionAction[]>;

/** Modules every workspace member may open (read-only shortcuts). */
export const SHARED_VIEW_MODULES: string[] = ['dashboard', 'apps'];

const actions = (...list: PermissionAction[]): PermissionAction[] => list;

const VIEW = actions('view');
const VIEW_EXPORT = actions('view', 'export');
const FULL_EDIT = actions('view', 'create', 'update', 'export');
const FULL_CYCLE = actions('view', 'create', 'update', 'delete', 'validate', 'export');

/**
 * Default action set for the built-in (non-editable) roles.
 * The company administrator always keeps every permission on every module.
 */
export const BUILTIN_PERMISSIONS: Record<Role, ModulePermissions> = {
  'admin-entreprise': Object.fromEntries(
    ALL_MODULES.map((module) => [module, FULL_CYCLE]),
  ),
  commercial: {
    dashboard: VIEW,
    apps: VIEW,
    'ai-assistant': VIEW,
    contacts: FULL_EDIT,
    products: FULL_EDIT,
    sales: FULL_CYCLE,
    invoices: FULL_CYCLE,
    payments: [...FULL_EDIT, 'validate'],
    reports: VIEW_EXPORT,
  },
  acheteur: {
    dashboard: VIEW,
    apps: VIEW,
    contacts: FULL_EDIT,
    products: [...VIEW, 'update', 'export'],
    purchases: FULL_CYCLE,
    reports: VIEW_EXPORT,
  },
  magasinier: {
    dashboard: VIEW,
    apps: VIEW,
    products: [...VIEW, 'update'],
    stock: FULL_CYCLE,
  },
  comptable: {
    dashboard: VIEW,
    apps: VIEW,
    invoices: [...VIEW, 'update', 'validate', 'export'],
    payments: FULL_CYCLE,
    purchases: VIEW_EXPORT,
    accounting: FULL_EDIT,
    invoicing: [...VIEW, 'update', 'export'],
    reports: VIEW_EXPORT,
  },
  directeur: {
    dashboard: VIEW_EXPORT,
    apps: VIEW,
    contacts: VIEW_EXPORT,
    products: VIEW_EXPORT,
    sales: [...VIEW, 'validate', 'export'],
    invoices: [...VIEW, 'validate', 'export'],
    payments: [...VIEW, 'validate', 'export'],
    purchases: [...VIEW, 'validate', 'export'],
    stock: VIEW_EXPORT,
    accounting: VIEW_EXPORT,
    reports: VIEW_EXPORT,
  },
  'client-externe': {},
  'super-admin': {},
};

export type ActivityAction =
  | 'login'
  | 'create'
  | 'update'
  | 'delete'
  | 'validate'
  | 'payment'
  | 'export';

/** Mirrors the backend ActivityResponse. Dates are ISO strings. */
export interface ActivityEntry {
  id: string;
  at: string;
  userName: string;
  userEmail: string;
  module: string;
  action: ActivityAction;
  detail: string | null;
  entityType: string | null;
  entityId: string | null;
}

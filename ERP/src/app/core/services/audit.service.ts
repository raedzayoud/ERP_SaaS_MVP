import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export type AuditAction =
  | 'login'
  | 'create'
  | 'update'
  | 'delete'
  | 'validate'
  | 'payment'
  | 'export';

export interface AuditEntry {
  id: string;
  at: string;
  userName: string;
  userEmail: string;
  module: string;
  action: AuditAction;
  detail: string;
}

const SEED_ENTRIES: AuditEntry[] = [
  {
    id: 'au-1001',
    at: '2026-10-27T08:12:00.000Z',
    userName: 'Amira Ben Salah',
    userEmail: 'admin@demo.com',
    module: 'settings',
    action: 'update',
    detail: 'Tenant profile updated',
  },
  {
    id: 'au-1002',
    at: '2026-10-27T09:03:00.000Z',
    userName: 'Purchaser',
    userEmail: 'acheteur@demo.com',
    module: 'purchases',
    action: 'validate',
    detail: 'BC-2026-0004 confirmed',
  },
  {
    id: 'au-1003',
    at: '2026-10-27T10:47:00.000Z',
    userName: 'Purchaser',
    userEmail: 'acheteur@demo.com',
    module: 'purchases',
    action: 'create',
    detail: 'FA-2026-0002 issued',
  },
  {
    id: 'au-1004',
    at: '2026-10-27T14:20:00.000Z',
    userName: 'Accountant',
    userEmail: 'comptable@demo.com',
    module: 'payments',
    action: 'payment',
    detail: 'Payment PA-3301 recorded (transfer, $500)',
  },
];

/**
 * Lightweight activity journal for the company administrator:
 * every checked workflow writes here who did what, when.
 */
@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly auth = inject(AuthService);
  private readonly entries = signal<AuditEntry[]>(toFreshSeed());
  private counter = 0;

  log(module: string, action: AuditAction, detail: string): void {
    const user = this.auth.currentUser();
    const entry: AuditEntry = {
      id: `au-${Date.now()}-${++this.counter}`,
      at: new Date().toISOString(),
      userName: user?.name ?? 'Unknown',
      userEmail: user?.email ?? '',
      module,
      action,
      detail,
    };
    this.entries.update((list) => [entry, ...list]);
  }

  /** Newest first journal (bounded to keep the card small). */
  recent(limit = 10): AuditEntry[] {
    return this.entries().slice(0, limit);
  }

  /** Journal restored to a realistic demo state (fresh session). */
  reset(): void {
    this.entries.set(toFreshSeed());
    this.counter = 0;
  }
}

/** Re-seeds the demo journal so dates stay current across page reloads. */
function toFreshSeed(): AuditEntry[] {
  const now = Date.now();
  return SEED_ENTRIES.map((entry, index) => ({
    ...entry,
    at: new Date(now - (index + 1) * 30 * 60 * 1000).toISOString(),
  }));
}

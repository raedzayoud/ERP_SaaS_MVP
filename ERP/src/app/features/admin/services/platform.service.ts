import { Injectable, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import {
  Plan,
} from '../../../core/models/plan';
import {
  clearPlanPriceOverrides,
  getAllPlans,
  getPlanById,
  savePlanPriceOverride,
} from '../../../core/data/plans';
import { PlatformStats, PlatformTenant } from '../models/platform';

const LATENCY_MS = 300;

const SEED_TENANTS: PlatformTenant[] = [
  {
    id: 1,
    companyName: 'Demo SARL',
    subdomain: 'demo',
    email: 'admin@demo.com',
    planId: 'enterprise',
    status: 'active',
    usersCount: 6,
    storageUsedGb: 2.4,
    createdAt: '2026-08-12T10:00:00.000Z',
  },
  {
    id: 2,
    companyName: 'Atlas Consulting',
    subdomain: 'atlas',
    email: 'contact@atlas.tn',
    planId: 'business',
    status: 'active',
    usersCount: 11,
    storageUsedGb: 5.1,
    createdAt: '2026-09-01T09:30:00.000Z',
  },
  {
    id: 3,
    companyName: 'Nordic Imports',
    subdomain: 'nordic',
    email: 'hello@nordic.se',
    planId: 'starter',
    status: 'trial',
    usersCount: 2,
    storageUsedGb: 0.3,
    createdAt: '2026-10-14T14:20:00.000Z',
  },
  {
    id: 4,
    companyName: 'Sahel Distribution',
    subdomain: 'sahel',
    email: 'admin@sahel.tn',
    planId: 'business',
    status: 'suspended',
    usersCount: 8,
    storageUsedGb: 7.8,
    createdAt: '2026-06-22T08:00:00.000Z',
  },
];

/** Mock platform data for the super-admin console. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly items = signal<PlatformTenant[]>(SEED_TENANTS);

  getTenants(): Observable<PlatformTenant[]> {
    return timer(LATENCY_MS).pipe(map(() => this.items()));
  }

  getStats(): Observable<PlatformStats> {
    return timer(LATENCY_MS).pipe(map(() => this.buildStats()));
  }

  toggleStatus(tenantId: number): Observable<PlatformTenant | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const tenant = this.items().find((t) => t.id === tenantId);
        if (!tenant) return undefined;

        const nextStatus =
          tenant.status === 'suspended'
            ? 'active'
            : tenant.status === 'active'
              ? 'suspended'
              : tenant.status;

        const updated: PlatformTenant = { ...tenant, status: nextStatus };
        this.items.update((list) => list.map((t) => (t.id === tenantId ? updated : t)));
        return updated;
      }),
    );
  }

  /** New price catalog for the super-admin console (single function). */
  updatePlanPrice(planId: string, priceMonthly: number, priceAnnual: number): Observable<Plan> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        savePlanPriceOverride(planId, { priceMonthly, priceAnnual });
        return getPlanById(planId);
      }),
    );
  }

  /** Removes every price override and returns the default plan list. */
  resetPlanPrices(): Observable<Plan[]> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        clearPlanPriceOverrides();
        return getAllPlans();
      }),
    );
  }

  private buildStats(): PlatformStats {
    const tenants = this.items();
    const totalUsers = tenants.reduce((sum, t) => sum + t.usersCount, 0);
    const monthlyRevenue = tenants
      .filter((t) => t.status === 'active')
      .reduce((sum, t) => sum + getPlanById(t.planId).priceMonthly, 0);

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'active').length,
      trialTenants: tenants.filter((t) => t.status === 'trial').length,
      suspendedTenants: tenants.filter((t) => t.status === 'suspended').length,
      totalUsers,
      monthlyRevenue,
    };
  }
}

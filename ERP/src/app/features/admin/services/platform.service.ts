import { Injectable, signal } from '@angular/core';
import { Observable, map, timer } from 'rxjs';
import { Plan } from '../../../core/models/plan';
import { safeStorage } from '../../../core/utils/safe-storage';
import {
  SubscriptionPayment,
  PaymentStatus,
  SignupRequest,
  SignupRequestDocuments,
  SignupStatus,
  PlatformStats,
  PlatformTenant,
} from '../models/platform';
import {
  clearPlanPriceOverrides,
  getAllPlans,
  getPlanById,
  savePlanPriceOverride,
} from '../../../core/data/plans';

const LATENCY_MS = 300;
const TENANTS_KEY = 'platform_tenants';
const SIGNUPS_KEY = 'platform_signups';
const PAYMENTS_KEY = 'platform_payments';

function loadFromStorage<T>(key: string): T[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage<T>(key: string, items: T[]): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(items));
  } catch {
    // mock app: ignore storage issues
  }
}

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

const SEED_SIGNUPS: SignupRequest[] = [
  {
    id: 1,
    companyName: 'Falcon Trading',
    subdomain: 'falcon',
    email: 'contact@falcon.tn',
    country: 'TN',
    planId: 'business',
    status: 'pending',
    documents: { idCard: { kind: 'submitted' }, tradeRegister: { kind: 'submitted' }, taxRegistration: { kind: 'submitted' } },
    createdAt: '2026-10-20T09:00:00.000Z',
  },
  {
    id: 2,
    companyName: 'Oasis Medic',
    subdomain: 'oasis',
    email: 'info@oasis.tn',
    country: 'TN',
    planId: 'starter',
    status: 'pending',
    documents: { idCard: { kind: 'submitted' }, tradeRegister: { kind: 'submitted' }, taxRegistration: { kind: 'submitted' } },
    createdAt: '2026-10-24T15:30:00.000Z',
  },
  {
    id: 3,
    companyName: 'Silk Furnitures',
    subdomain: 'silk',
    email: 'sales@silk.ma',
    country: 'MA',
    planId: 'enterprise',
    status: 'pending',
    documents: { idCard: { kind: 'submitted' }, tradeRegister: { kind: 'submitted' }, taxRegistration: { kind: 'submitted' } },
    createdAt: '2026-10-26T11:45:00.000Z',
  },
];

/** One statement per active/suspended tenant for 3 billing periods. */
const SEED_PAYMENTS: SubscriptionPayment[] = [
  { id: 1, tenantId: 1, period: '2026-08', amount: 199, status: 'paid', dueDate: '2026-08-01' },
  { id: 2, tenantId: 1, period: '2026-09', amount: 199, status: 'paid', dueDate: '2026-09-01' },
  { id: 3, tenantId: 1, period: '2026-10', amount: 199, status: 'pending', dueDate: '2026-10-01' },
  { id: 4, tenantId: 2, period: '2026-09', amount: 79, status: 'paid', dueDate: '2026-09-01' },
  { id: 5, tenantId: 2, period: '2026-10', amount: 79, status: 'pending', dueDate: '2026-10-01' },
  { id: 6, tenantId: 4, period: '2026-08', amount: 79, status: 'paid', dueDate: '2026-08-01' },
  { id: 7, tenantId: 4, period: '2026-09', amount: 79, status: 'overdue', dueDate: '2026-09-01' },
  { id: 8, tenantId: 4, period: '2026-10', amount: 79, status: 'overdue', dueDate: '2026-10-01' },
];

/** Mock platform data for the super-admin console, persisted in localStorage. */
@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly items = signal<PlatformTenant[]>(
    loadFromStorage<PlatformTenant>(TENANTS_KEY).length > 0
      ? loadFromStorage<PlatformTenant>(TENANTS_KEY)
      : SEED_TENANTS,
  );
  private readonly signups = signal<SignupRequest[]>(
    loadFromStorage<SignupRequest>(SIGNUPS_KEY).length > 0
      ? loadFromStorage<SignupRequest>(SIGNUPS_KEY)
      : SEED_SIGNUPS,
  );
  private readonly payments = signal<SubscriptionPayment[]>(
    loadFromStorage<SubscriptionPayment>(PAYMENTS_KEY).length > 0
      ? loadFromStorage<SubscriptionPayment>(PAYMENTS_KEY)
      : SEED_PAYMENTS,
  );
  private counter = 0;

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

        return this.replaceTenant({ ...tenant, status: nextStatus });
      }),
    );
  }

  // ── Signups & KYC ─────────────────────────────

  getSignups(): Observable<SignupRequest[]> {
    return timer(LATENCY_MS).pipe(map(() => this.signups()));
  }

  /**
   * Files the request created by the signup wizard: documents were uploaded
   * by the company itself and the plan was already paid, so it lands approved.
   */
  createSignupRequest(input: {
    companyName: string;
    subdomain: string;
    email: string;
    country: string;
    planId: string;
    documents: SignupRequestDocuments;
    decisionNote: string;
  }): Observable<SignupRequest> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const request: SignupRequest = {
          id: Math.max(0, ...this.signups().map((s) => s.id)) + 1 + this.counter++,
          ...input,
          status: 'approved' as SignupStatus,
          createdAt: new Date().toISOString(),
          decidedAt: new Date().toISOString(),
        };

        this.signups.update((list) => [...list, request]);
        saveToStorage(SIGNUPS_KEY, this.signups());
        return request;
      }),
    );
  }

  /** Validates the registration: the company joins the platform in trial. */
  approveSignup(signupId: number): Observable<SignupRequest | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const signup = this.signups().find((s) => s.id === signupId);
        if (!signup || signup.status !== 'pending') return undefined;

        const tenant: PlatformTenant = {
          id: Math.max(0, ...this.items().map((t) => t.id)) + 1 + this.counter++,
          companyName: signup.companyName,
          subdomain: signup.subdomain,
          email: signup.email,
          planId: signup.planId,
          status: 'trial',
          usersCount: 1,
          storageUsedGb: 0,
          createdAt: new Date().toISOString(),
        };

        this.items.update((list) => [...list, tenant]);
        saveToStorage(TENANTS_KEY, this.items());

        const approved = this.replaceSignup(
          { ...signup, status: 'approved' as SignupStatus, decidedAt: new Date().toISOString() },
          'approved',
        );
        return approved;
      }),
    );
  }

  /** Rejects the registration with an explicit note (kept in the history). */
  rejectSignup(signupId: number, note: string): Observable<SignupRequest | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const signup = this.signups().find((s) => s.id === signupId);
        if (!signup || signup.status !== 'pending') return undefined;

        return this.replaceSignup(
          {
            ...signup,
            status: 'rejected' as SignupStatus,
            decidedAt: new Date().toISOString(),
            decisionNote: note.trim() || '—',
          },
          'rejected',
        );
      }),
    );
  }

  // ── Subscription payments ─────────────────────

  getPayments(): Observable<SubscriptionPayment[]> {
    return timer(LATENCY_MS).pipe(map(() => this.payments()));
  }

  markPaymentPaid(paymentId: number): Observable<SubscriptionPayment | undefined> {
    return timer(LATENCY_MS).pipe(
      map(() => {
        const payment = this.payments().find((p) => p.id === paymentId);
        if (!payment || payment.status === 'paid') return undefined;

        const updated: SubscriptionPayment = { ...payment, status: 'paid' as PaymentStatus };
        this.payments.update((list) => list.map((p) => (p.id === paymentId ? updated : p)));
        saveToStorage(PAYMENTS_KEY, this.payments());
        return updated;
      }),
    );
  }

  // ── Price catalog ─────────────────────────────

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

  // ── Internals ─────────────────────────────────

  private replaceTenant(updated: PlatformTenant): PlatformTenant {
    this.items.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    saveToStorage(TENANTS_KEY, this.items());
    return updated;
  }

  private replaceSignup(
    updated: SignupRequest,
    status: 'approved' | 'rejected',
  ): SignupRequest {
    this.signups.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
    saveToStorage(SIGNUPS_KEY, this.signups());
    // Narrowed return so callers can safely read the decided request.
    return updated;
  }

  private buildStats(): PlatformStats {
    const tenants = this.items();
    const totalUsers = tenants.reduce((sum, t) => sum + t.usersCount, 0);
    const monthlyRevenue = tenants
      .filter((t) => t.status === 'active')
      .reduce((sum, t) => sum + getPlanById(t.planId).priceMonthly, 0);
    const overdueAmount = this.payments()
      .filter((p) => p.status === 'overdue')
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === 'active').length,
      trialTenants: tenants.filter((t) => t.status === 'trial').length,
      suspendedTenants: tenants.filter((t) => t.status === 'suspended').length,
      totalUsers,
      monthlyRevenue,
      pendingSignups: this.signups().filter((s) => s.status === 'pending').length,
      overdueAmount,
    };
  }
}

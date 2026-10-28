import { Injectable, signal, computed } from '@angular/core';
import { safeStorage } from '../utils/safe-storage';
import { Tenant, TenantUser } from '../models/tenant';
import { getPlanById, getPlanForModules } from '../data/plans';

export interface RegisterTenantData {
  fullName: string;
  companyName: string;
  subdomain: string;
  email: string;
  country: string;
  language: string;
  companySize: string;
  modules: string[];
}

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly storageKey = 'erp_tenant';
  private readonly subdomainsKey = 'erp_subdomains';

  currentTenant = signal<Tenant | null>(this.loadTenant());

  currentPlan = computed(() => {
    const tenant = this.currentTenant();
    return tenant ? getPlanById(tenant.planId) : null;
  });

  enabledModules = computed<string[]>(() => {
    const tenant = this.currentTenant();
    return tenant ? tenant.enabledModules : [];
  });

  isModuleEnabled(moduleId: string): boolean {
    return this.enabledModules().includes(moduleId);
  }

  /** The display currency of the current workspace (fallback for pages without a tenant). */
  activeCurrency(): string {
    return this.currentTenant()?.currency ?? 'USD';
  }

  isSubdomainAvailable(subdomain: string): boolean {
    if (!subdomain) return false;
    const reserved = ['admin', 'api', 'www', 'app', 'login', 'signup', 'dashboard'];
    if (reserved.includes(subdomain)) return false;
    const taken = this.loadSubdomains();
    return !taken.includes(subdomain);
  }

  registerTenant(data: RegisterTenantData): Tenant {
    const plan = getPlanForModules(data.modules);

    const tenant: Tenant = {
      id: Date.now(),
      companyName: data.companyName,
      email: data.email,
      subdomain: data.subdomain,
      country: data.country,
      language: data.language,
      companySize: data.companySize,
      planId: plan.id,
      enabledModules: [...data.modules],
      users: [
        {
          id: 1,
          name: data.fullName,
          email: data.email,
          role: 'admin-entreprise',
        },
      ],
      currency: 'USD',
      taxId: '',
      address: '',
      createdAt: new Date().toISOString(),
    };

    this.saveTenant(tenant);
    this.saveSubdomain(data.subdomain);
    this.currentTenant.set(tenant);
    return tenant;
  }

  /**
   * Creates a full-access demo workspace on first login of a tenant role.
   * Does nothing if a workspace already exists.
   */
  ensureDemoTenant(): Tenant {
    const existing = this.currentTenant();
    if (existing) return existing;

    const plan = getPlanById('enterprise');
    const tenant: Tenant = {
      id: Date.now(),
      companyName: 'Demo SARL',
      email: 'admin@demo.com',
      subdomain: 'demo',
      country: 'TN',
      language: 'en',
      companySize: '1-5',
      planId: plan.id,
      enabledModules: [...plan.modules],
      users: [
        { id: 1, name: 'Amira Ben Salah', email: 'admin@demo.com', role: 'admin-entreprise' },
      ],
      currency: 'USD',
      taxId: '12034567/A/M/000',
      address: '12 Rue de la République, Tunis',
      createdAt: new Date().toISOString(),
    };

    this.saveTenant(tenant);
    this.saveSubdomain('demo');
    this.currentTenant.set(tenant);
    return tenant;
  }

  updateCompany(
    data: Partial<
      Pick<
        Tenant,
        | 'companyName'
        | 'email'
        | 'currency'
        | 'taxId'
        | 'address'
        | 'country'
        | 'language'
        | 'companySize'
      >
    >,
  ): void {
    const tenant = this.currentTenant();
    if (!tenant) return;
    const updated = { ...tenant, ...data };
    this.saveTenant(updated);
    this.currentTenant.set(updated);
  }

  addUser(user: Omit<TenantUser, 'id'>): boolean {
    const tenant = this.currentTenant();
    if (!tenant) return false;

    const plan = getPlanById(tenant.planId);
    if (tenant.users.length >= plan.maxUsers) {
      return false;
    }

    const newUser: TenantUser = {
      id: Date.now(),
      ...user,
    };

    const updated: Tenant = {
      ...tenant,
      users: [...tenant.users, newUser],
    };
    this.saveTenant(updated);
    this.currentTenant.set(updated);
    return true;
  }

  removeUser(userId: number): void {
    const tenant = this.currentTenant();
    if (!tenant || tenant.users.length <= 1) return;

    const updated: Tenant = {
      ...tenant,
      users: tenant.users.filter((u) => u.id !== userId),
    };
    this.saveTenant(updated);
    this.currentTenant.set(updated);
  }

  /** Deactivated members lose their workspace access until reactivated. */
  setUserActive(userId: number, active: boolean): void {
    this.patchUser(userId, { active });
  }

  /** Flags a member so login redirects them to the password renewal page. */
  setUserMustRenew(userId: number, mustRenew: boolean): void {
    this.patchUser(userId, { mustRenewPassword: mustRenew });
  }

  private patchUser(userId: number, patch: Partial<TenantUser>): void {
    const tenant = this.currentTenant();
    if (!tenant) return;

    const updated: Tenant = {
      ...tenant,
      users: tenant.users.map((user) =>
        user.id === userId ? { ...user, ...patch } : user,
      ),
    };
    this.saveTenant(updated);
    this.currentTenant.set(updated);
  }

  upgradePlan(planId: string): void {
    const tenant = this.currentTenant();
    if (!tenant) return;

    const plan = getPlanById(planId);
    const updated: Tenant = {
      ...tenant,
      planId,
      enabledModules: [...plan.modules],
    };
    this.saveTenant(updated);
    this.currentTenant.set(updated);
  }

  clearTenant(): void {
    safeStorage()?.removeItem(this.storageKey);
    this.currentTenant.set(null);
  }

  private saveTenant(tenant: Tenant): void {
    safeStorage()?.setItem(this.storageKey, JSON.stringify(tenant));
  }

  private loadTenant(): Tenant | null {
    const data = safeStorage()?.getItem(this.storageKey);
    if (data) {
      try {
        return JSON.parse(data) as Tenant;
      } catch {
        return null;
      }
    }
    return null;
  }

  private saveSubdomain(subdomain: string): void {
    const taken = this.loadSubdomains();
    if (!taken.includes(subdomain)) {
      taken.push(subdomain);
      safeStorage()?.setItem(this.subdomainsKey, JSON.stringify(taken));
    }
  }

  private loadSubdomains(): string[] {
    const data = safeStorage()?.getItem(this.subdomainsKey);
    if (data) {
      try {
        return JSON.parse(data) as string[];
      } catch {
        return [];
      }
    }
    return [];
  }
}

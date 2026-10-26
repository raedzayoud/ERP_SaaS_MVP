import { Component, signal, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TenantService } from '../../../../core/services/tenant.service';
import { AuthService } from '../../../../core/services/auth.service';
import { PLANS, getPlanById } from '../../../../core/data/plans';
import { Tenant } from '../../../../core/models/tenant';
import { COUNTRIES, LANGUAGES, COMPANY_SIZES } from '../../../../core/data/countries';
import { ASSIGNEE_ROLES, ROLE_INFO, Role, roleLabelKey } from '../../../../core/models/role';

type SettingsTab = 'company' | 'users' | 'roles' | 'subscription';

const ROLE_BADGE_CLASS: Record<Role, string> = {
  'super-admin': 'badge-primary',
  'admin-entreprise': 'badge-primary',
  commercial: 'badge-success',
  acheteur: 'badge-info',
  magasinier: 'badge-warning',
  comptable: 'badge-info',
  directeur: 'badge-primary',
  'client-externe': 'badge-warning',
};

@Component({
  selector: 'app-settings',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent {
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);

  tenant = this.tenantService.currentTenant;
  plan = this.tenantService.currentPlan;
  plans = PLANS;

  activeTab = signal<SettingsTab>('company');

  // ── Company tab ──────────────────────────────
  companyName = signal('');
  companyEmail = signal('');
  currency = signal('USD');
  taxId = signal('');
  address = signal('');
  country = signal('TN');
  language = signal('en');
  companySize = signal('1-5');
  companySaved = signal(false);

  countries = COUNTRIES;
  languages = LANGUAGES;
  companySizes = COMPANY_SIZES;

  // ── Users tab ────────────────────────────────
  showAddUser = signal(false);
  newUserName = signal('');
  newUserEmail = signal('');
  newUserRole = signal<Role>('commercial');
  userError = signal('');
  userSuccess = signal('');

  // ── Roles definitions ───────────────────────
  readonly assigneeRoles = ASSIGNEE_ROLES;
  readonly roleInfo = ROLE_INFO.filter((r) => ASSIGNEE_ROLES.includes(r.role));

  roleLabel(role: Role): string {
    return roleLabelKey(role);
  }

  roleBadgeClass(role: Role): string {
    return `badge ${ROLE_BADGE_CLASS[role] ?? 'badge-info'}`;
  }

  // ── Subscription tab ─────────────────────────
  billingCycle = signal<'monthly' | 'annual'>('monthly');
  upgradeSuccess = signal('');

  // ── Computed ─────────────────────────────────
  currentUser = this.authService.currentUser;
  workspaceAddress = computed(() => {
    const sub = this.tenant()?.subdomain;
    return sub ? `${sub}.erpcloud.com` : '';
  });
  planLimit = computed(() => this.plan()?.maxUsers ?? 3);
  userCount = computed(() => this.tenant()?.users.length ?? 0);
  canAddUser = computed(() => this.userCount() < this.planLimit());

  constructor() {
    this.loadCompanyData();
  }

  // ── Tab switching ────────────────────────────
  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.companySaved.set(false);
    this.upgradeSuccess.set('');
  }

  // ── Company actions ──────────────────────────
  private loadCompanyData(): void {
    const t = this.tenant();
    if (t) {
      this.companyName.set(t.companyName);
      this.companyEmail.set(t.email);
      this.currency.set(t.currency);
      this.taxId.set(t.taxId);
      this.address.set(t.address);
      this.country.set(t.country ?? 'TN');
      this.language.set(t.language ?? 'en');
      this.companySize.set(t.companySize ?? '1-5');
    }
  }

  saveCompany(): void {
    this.tenantService.updateCompany({
      companyName: this.companyName(),
      email: this.companyEmail(),
      currency: this.currency(),
      taxId: this.taxId(),
      address: this.address(),
      country: this.country(),
      language: this.language(),
      companySize: this.companySize(),
    });
    this.companySaved.set(true);
    setTimeout(() => this.companySaved.set(false), 3000);
  }

  // ── User actions ─────────────────────────────
  toggleAddUser(): void {
    this.showAddUser.update((v) => !v);
    this.userError.set('');
    this.userSuccess.set('');
    this.newUserName.set('');
    this.newUserEmail.set('');
    this.newUserRole.set('commercial');
  }

  addUser(): void {
    this.userError.set('');
    this.userSuccess.set('');

    if (!this.newUserName().trim() || !this.newUserEmail().includes('@')) {
      this.userError.set('Please enter a valid name and email.');
      return;
    }

    const success = this.tenantService.addUser({
      name: this.newUserName(),
      email: this.newUserEmail(),
      role: this.newUserRole(),
    });

    if (success) {
      this.userSuccess.set('User added successfully.');
      this.showAddUser.set(false);
      this.newUserName.set('');
      this.newUserEmail.set('');
      setTimeout(() => this.userSuccess.set(''), 3000);
    } else {
      this.userError.set('User limit reached for your plan. Please upgrade.');
    }
  }

  removeUser(userId: number): void {
    this.tenantService.removeUser(userId);
  }

  // ── Plan actions ─────────────────────────────
  toggleBilling(): void {
    this.billingCycle.update((b) => (b === 'monthly' ? 'annual' : 'monthly'));
  }

  upgradePlan(planId: string): void {
    if (planId === this.tenant()?.planId) return;
    this.tenantService.upgradePlan(planId);
    this.upgradeSuccess.set(`Plan upgraded to ${getPlanById(planId).name}!`);
    setTimeout(() => this.upgradeSuccess.set(''), 3000);
  }

  // ── Input handlers ───────────────────────────
  onCompanyInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const map: Record<string, (v: string) => void> = {
      companyName: (v) => this.companyName.set(v),
      companyEmail: (v) => this.companyEmail.set(v),
      currency: (v) => this.currency.set(v),
      taxId: (v) => this.taxId.set(v),
      address: (v) => this.address.set(v),
      country: (v) => this.country.set(v),
      language: (v) => this.language.set(v),
      companySize: (v) => this.companySize.set(v),
    };
    map[field]?.(value);
  }

  onUserInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const map: Record<string, (v: string) => void> = {
      name: (v) => this.newUserName.set(v),
      email: (v) => this.newUserEmail.set(v),
    };
    map[field]?.(value);
  }

  onRoleChange(event: Event): void {
    this.newUserRole.set((event.target as HTMLSelectElement).value as Role);
  }
}

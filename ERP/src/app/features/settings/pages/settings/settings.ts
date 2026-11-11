import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TenantService } from '../../../../core/services/tenant.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BillingApiService } from '../../../../core/services/billing-api.service';
import { getPlanById, getAllPlans } from '../../../../core/data/plans';
import { BillingInterval } from '../../../../core/models/auth';
import { BillingStatusResponse } from '../../../../core/models/billing';
import { Plan } from '../../../../core/models/plan';
import { COUNTRIES, LANGUAGES, COMPANY_SIZES } from '../../../../core/data/countries';
import { ASSIGNEE_ROLES, ROLE_INFO, Role, roleLabelKey } from '../../../../core/models/role';
import { CompanySettingsRequest, TeamMember } from '../../models/settings';
import { ActivityEntry } from '../../models/activity';
import { SettingsApiService } from '../../services/settings-api.service';
import { ActivityApiService } from '../../services/activity-api.service';

type SettingsTab = 'company' | 'users' | 'roles' | 'subscription';
type ErrorContext = 'save' | 'user' | 'billing';

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
  imports: [RouterLink, TranslocoDirective, DatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent {
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);
  private transloco = inject(TranslocoService);
  private api = inject(SettingsApiService);
  private activityApi = inject(ActivityApiService);
  private billingApi = inject(BillingApiService);
  private destroyRef = inject(DestroyRef);

  tenant = this.tenantService.currentTenant;
  plans = getAllPlans();

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
  companySaving = signal(false);
  companyError = signal('');

  countries = COUNTRIES;
  languages = LANGUAGES;
  companySizes = COMPANY_SIZES;

  // ── Users tab ────────────────────────────────
  users = signal<TeamMember[]>([]);
  usersLoading = signal(true);
  usersLoadFailed = signal(false);

  showAddUser = signal(false);
  newUserName = signal('');
  newUserEmail = signal('');
  newUserRole = signal<Role>('commercial');
  newUserPassword = signal('');
  newUserMustRenew = signal(true);
  userError = signal('');
  userSuccess = signal('');

  // ── Roles definitions ───────────────────────
  readonly assigneeRoles = ASSIGNEE_ROLES;
  readonly roleInfo = ROLE_INFO.filter((r) => ASSIGNEE_ROLES.includes(r.role));

  // ── Recent activity (audit trail) ───────────
  activity = signal<ActivityEntry[]>([]);
  activityLoading = signal(true);
  activityLoadFailed = signal(false);

  roleLabel(role: Role): string {
    return roleLabelKey(role);
  }

  roleBadgeClass(role: Role): string {
    return `badge ${ROLE_BADGE_CLASS[role] ?? 'badge-info'}`;
  }

  // ── Subscription tab ─────────────────────────
  billing = signal<BillingStatusResponse | null>(null);
  billingCycle = signal<'monthly' | 'annual'>('monthly');
  billingError = signal('');
  billingActionLoading = signal(false);

  // ── Computed ─────────────────────────────────
  currentUser = this.authService.currentUser;
  workspaceAddress = computed(() => {
    const sub = this.tenant()?.subdomain;
    return sub ? `${sub}.erpcloud.com` : '';
  });
  currentPlanId = computed(
    () => this.billing()?.planId ?? this.tenant()?.planId ?? 'starter',
  );
  plan = computed<Plan | null>(() => getPlanById(this.currentPlanId()));
  planLimit = computed(() => this.plan()?.maxUsers ?? 3);
  userCount = computed(() => this.users().length);
  canAddUser = computed(() => this.userCount() < this.planLimit());
  billingStatus = computed(
    () => this.billing()?.billingStatus ?? this.tenant()?.billingStatus ?? '',
  );
  hasActiveSubscription = computed(() =>
    ['ACTIVE', 'PAST_DUE'].includes(this.billingStatus()),
  );
  billingExempt = computed(() => this.billingStatus() === 'EXEMPT');

  constructor() {
    this.loadCompanyData();
    this.loadCompany();
    this.loadUsers();
    this.loadBilling();
  }

  // ── Tab switching ────────────────────────────
  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.companySaved.set(false);
    this.billingError.set('');
    if (tab === 'users') {
      this.loadActivity();
    }
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

  loadCompany(): void {
    this.companyError.set('');
    this.api
      .getCompany()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (company) => {
          this.tenantService.setFromAuthTenant(company);
          this.loadCompanyData();
        },
        error: (error: unknown) => this.companyError.set(this.errorKey(error, 'save')),
      });
  }

  saveCompany(): void {
    if (this.companySaving()) return;
    this.companyError.set('');

    if (!this.companyName().trim()) {
      this.companyError.set('settings.messages.companyInvalid');
      return;
    }

    const request: CompanySettingsRequest = {
      companyName: this.companyName(),
      currency: this.currency(),
      address: this.address(),
      country: this.country(),
      language: this.language(),
      companySize: this.companySize(),
    };

    this.companySaving.set(true);
    this.api
      .updateCompany(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (company) => {
          this.companySaving.set(false);
          this.tenantService.setFromAuthTenant(company);
          this.loadCompanyData();
          this.companySaved.set(true);
          setTimeout(() => this.companySaved.set(false), 3000);
        },
        error: (error: unknown) => {
          this.companySaving.set(false);
          this.companyError.set(this.errorKey(error, 'save'));
        },
      });
  }

  // ── User actions ─────────────────────────────
  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersLoadFailed.set(false);
    this.api
      .getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => {
          this.users.set(users);
          this.usersLoading.set(false);
        },
        error: () => {
          this.usersLoadFailed.set(true);
          this.usersLoading.set(false);
        },
      });
  }

  loadActivity(): void {
    this.activityLoading.set(true);
    this.activityLoadFailed.set(false);
    this.activityApi
      .recent(8)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.activity.set(entries);
          this.activityLoading.set(false);
        },
        error: () => {
          this.activityLoadFailed.set(true);
          this.activityLoading.set(false);
        },
      });
  }

  toggleAddUser(): void {
    this.showAddUser.update((v) => !v);
    this.userError.set('');
    this.userSuccess.set('');
    this.resetAddUserForm();
  }

  addUser(): void {
    this.userError.set('');
    this.userSuccess.set('');

    const name = this.newUserName().trim();
    const email = this.newUserEmail().trim();
    const password = this.newUserPassword();

    if (!name || !email.includes('@') || password.length < 8) {
      this.userError.set('settings.messages.userInvalid');
      return;
    }

    this.api
      .createUser({
        name,
        email,
        role: this.newUserRole(),
        password,
        mustRenewPassword: this.newUserMustRenew(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.users.update((list) => [...list, user]);
          this.userSuccess.set('settings.messages.userAdded');
          this.showAddUser.set(false);
          this.resetAddUserForm();
          this.loadActivity();
          setTimeout(() => this.userSuccess.set(''), 3000);
        },
        error: (error: unknown) => this.userError.set(this.errorKey(error, 'user')),
      });
  }

  /** Reactivate / deactivate a member (deactivated = no workspace access). */
  setUserActive(user: TeamMember, active: boolean): void {
    this.userError.set('');
    this.api
      .updateUser(user.id, { active })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceUser(updated);
          this.loadActivity();
        },
        error: (error: unknown) => this.userError.set(this.errorKey(error, 'user')),
      });
  }

  /** Ask the member to choose a new password at their next login. */
  requestRenewal(user: TeamMember): void {
    this.userError.set('');
    this.api
      .updateUser(user.id, { mustRenewPassword: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.replaceUser(updated);
          this.userSuccess.set('settings.messages.renewalRequested');
          this.loadActivity();
          setTimeout(() => this.userSuccess.set(''), 3000);
        },
        error: (error: unknown) => this.userError.set(this.errorKey(error, 'user')),
      });
  }

  /** Badge label for one member: builtin role label. */
  userRoleLabel(user: TeamMember): string {
    return this.transloco.translate(roleLabelKey(user.role));
  }

  userBadgeClass(user: TeamMember): string {
    return `badge ${ROLE_BADGE_CLASS[user.role] ?? 'badge-info'}`;
  }

  removeUser(user: TeamMember): void {
    if (!window.confirm(this.t('settings.messages.removeConfirm'))) {
      return;
    }

    this.userError.set('');
    this.api
      .deleteUser(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.users.update((list) => list.filter((u) => u.id !== user.id));
          this.userSuccess.set('settings.messages.userRemoved');
          this.loadActivity();
          setTimeout(() => this.userSuccess.set(''), 3000);
        },
        error: (error: unknown) => this.userError.set(this.errorKey(error, 'user')),
      });
  }

  private replaceUser(updated: TeamMember): void {
    this.users.update((list) =>
      list.map((user) => (user.id === updated.id ? updated : user)),
    );
  }

  private resetAddUserForm(): void {
    this.newUserName.set('');
    this.newUserEmail.set('');
    this.newUserRole.set('commercial');
    this.newUserPassword.set('');
    this.newUserMustRenew.set(true);
  }

  // ── Plan actions ─────────────────────────────
  toggleBilling(): void {
    this.billingCycle.update((b) => (b === 'monthly' ? 'annual' : 'monthly'));
  }

  loadBilling(): void {
    this.billingApi
      .subscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (billing) => this.billing.set(billing),
        error: (error: unknown) => this.billingError.set(this.errorKey(error, 'billing')),
      });
  }

  /** Opens Stripe Checkout when unpaid, or the billing portal when active. */
  startBilling(): void {
    if (this.billingActionLoading()) return;
    this.billingError.set('');
    this.billingActionLoading.set(true);

    const request = this.hasActiveSubscription()
      ? this.billingApi.portal()
      : this.billingApi.checkout(
          this.billingCycle().toUpperCase() as BillingInterval,
        );

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.billingActionLoading.set(false);
        if (response.url) {
          window.location.assign(response.url);
        } else {
          this.billingError.set('settings.messages.billingFailed');
        }
      },
      error: (error: unknown) => {
        this.billingActionLoading.set(false);
        this.billingError.set(this.errorKey(error, 'billing'));
      },
    });
  }

  // ── Input handlers ───────────────────────────
  onCompanyInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const map: Record<string, (v: string) => void> = {
      companyName: (v) => this.companyName.set(v),
      currency: (v) => this.currency.set(v),
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
      password: (v) => this.newUserPassword.set(v),
    };
    map[field]?.(value);
  }

  onRoleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.newUserRole.set(value as Role);
  }

  private errorKey(error: unknown, context: ErrorContext): string {
    if (!(error instanceof HttpErrorResponse)) {
      return this.fallbackKey(context);
    }
    if (error.status === 0) {
      return 'settings.messages.network';
    }
    if (error.status === 403) {
      return 'settings.messages.adminOnly';
    }

    const message = String(error.error?.message ?? '').toLowerCase();
    if (error.status === 409) {
      if (message.includes('plan user limit')) {
        return 'settings.messages.userLimit';
      }
      if (message.includes('email already in use')) {
        return 'settings.messages.userEmailTaken';
      }
      if (
        message.includes('last administrator') ||
        message.includes('last user')
      ) {
        return 'settings.messages.lastAdmin';
      }
      if (message.includes('subscription already exists')) {
        return 'settings.messages.subscriptionExists';
      }
    }
    if (error.status === 400 && context === 'user') {
      return 'settings.messages.userInvalid';
    }
    return this.fallbackKey(context);
  }

  private fallbackKey(context: ErrorContext): string {
    if (context === 'save') return 'settings.messages.saveFailed';
    if (context === 'billing') return 'settings.messages.billingFailed';
    return 'settings.messages.userFailed';
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.transloco.translate(key, params);
  }
}

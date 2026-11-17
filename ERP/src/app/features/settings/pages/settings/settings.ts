import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, signal, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Observable, catchError, map, of, switchMap } from 'rxjs';
import { TenantService } from '../../../../core/services/tenant.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BillingApiService } from '../../../../core/services/billing-api.service';
import { getPlanById, getAllPlans } from '../../../../core/data/plans';
import { BillingInterval } from '../../../../core/models/auth';
import { BillingStatusResponse } from '../../../../core/models/billing';
import { Plan } from '../../../../core/models/plan';
import { COUNTRIES, LANGUAGES, COMPANY_SIZES } from '../../../../core/data/countries';
import { ASSIGNEE_ROLES, ROLE_INFO, Role } from '../../../../core/models/role';
import { CompanySettingsRequest, ModuleCatalog, TeamMember } from '../../models/settings';
import { ActivityEntry } from '../../models/activity';
import { SettingsApiService } from '../../services/settings-api.service';
import { ActivityApiService } from '../../services/activity-api.service';

type SettingsTab = 'company' | 'activity' | 'roles' | 'subscription' | 'modules';
type ErrorContext = 'save' | 'billing';

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
  imports: [TranslocoDirective, DatePipe, CurrencyPipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent {
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);
  private api = inject(SettingsApiService);
  private activityApi = inject(ActivityApiService);
  private billingApi = inject(BillingApiService);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

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

  // ── Team members (count only, used by the plan limit) ─────────
  users = signal<TeamMember[]>([]);

  // ── Roles definitions ───────────────────────
  readonly roleInfo = ROLE_INFO.filter((r) => ASSIGNEE_ROLES.includes(r.role));

  // ── Recent activity (audit trail) ───────────
  activity = signal<ActivityEntry[]>([]);
  activityLoading = signal(true);
  activityLoadFailed = signal(false);

  roleBadgeClass(role: Role): string {
    return `badge ${ROLE_BADGE_CLASS[role] ?? 'badge-info'}`;
  }

  // ── Subscription tab ─────────────────────────
  billing = signal<BillingStatusResponse | null>(null);
  billingCycle = signal<'monthly' | 'annual'>('monthly');
  billingError = signal('');
  billingActionLoading = signal(false);

  // ── Modules tab ──────────────────────────────
  moduleCatalog = signal<ModuleCatalog | null>(null);
  modulesLoading = signal(false);
  modulesError = signal('');
  selectedModules = signal<string[]>([]);
  modulesBuying = signal(false);
  /** True while the app waits for the Stripe payment to be confirmed. */
  modulesWaiting = signal(false);

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
  billingStatus = computed(
    () => this.billing()?.billingStatus ?? this.tenant()?.billingStatus ?? '',
  );
  hasActiveSubscription = computed(() =>
    ['ACTIVE', 'PAST_DUE'].includes(this.billingStatus()),
  );
  billingExempt = computed(() => this.billingStatus() === 'EXEMPT');

  // ── Modules computed ─────────────────────────
  enabledModuleIds = computed(() => this.moduleCatalog()?.enabledModules ?? []);
  moduleOffers = computed(() => this.moduleCatalog()?.offers ?? []);
  moduleTotal = computed(() =>
    this.selectedModules().reduce((total, id) => {
      const offer = this.moduleOffers().find((one) => one.id === id);
      return total + (offer?.priceMonthly ?? 0);
    }, 0),
  );
  moduleCurrency = computed(() => this.moduleOffers()[0]?.currency ?? 'USD');

  constructor() {
    this.loadCompanyData();
    this.loadCompany();
    this.loadUsers();
    this.loadBilling();

    // Coming back from Stripe with ?tab=modules opens the tab that checks
    // the payment.
    if (this.route.snapshot.queryParamMap.get('tab') === 'modules') {
      this.setTab('modules');
    }
  }

  // ── Tab switching ────────────────────────────
  setTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.companySaved.set(false);
    this.billingError.set('');
    if (tab === 'activity') {
      this.loadActivity();
    }
    if (tab === 'modules') {
      this.loadModules();
    }
  }

  // ── Modules actions ──────────────────────────
  toggleModule(id: string): void {
    this.selectedModules.update((list) =>
      list.includes(id) ? list.filter((one) => one !== id) : [...list, id],
    );
  }

  isModuleEnabled(id: string): boolean {
    return this.enabledModuleIds().includes(id);
  }

  buyModules(): void {
    const modules = this.selectedModules();
    if (modules.length === 0 || this.modulesBuying()) {
      return;
    }

    this.modulesBuying.set(true);
    this.modulesError.set('');

    this.api
      .addModules(modules)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (purchase) => {
          // Stripe opens in another tab: the app stays here and checks the
          // payment until the module shows up.
          this.openStripeTab(purchase.url);
          this.modulesWaiting.set(true);
          this.startPaymentCheck();
        },
        error: (error: unknown) => {
          this.modulesBuying.set(false);
          this.modulesError.set(this.moduleErrorKey(error));
        },
      });
  }

  /** Opens the Stripe page in a new tab; kept public so the tests can replace it. */
  openStripeTab(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  /**
   * Looks for the paid module every few seconds and ends on the dashboard
   * with a success or failure message.
   */
  private startPaymentCheck(): void {
    const before = this.tenant()?.enabledModules ?? [];

    const attempt = (remaining: number): void => {
      this.checkPayment(before).subscribe((added) => {
        if (added.length > 0) {
          this.modulesWaiting.set(false);
          void this.router.navigate(['/dashboard'], {
            queryParams: { payment: 'success', modules: added.join(',') },
          });
          return;
        }
        if (remaining <= 0) {
          this.modulesWaiting.set(false);
          void this.router.navigate(['/dashboard'], { queryParams: { payment: 'failed' } });
          return;
        }
        setTimeout(() => attempt(remaining - 1), 5000);
      });
    };

    attempt(24);
  }

  /** One check: the backend reads the Stripe subscription, then the app reloads. */
  private checkPayment(before: string[]): Observable<string[]> {
    return this.billingApi.refresh().pipe(
      switchMap(() => this.authService.reloadAccount()),
      map(() => {
        const after = this.tenant()?.enabledModules ?? [];
        return after.filter((id) => !before.includes(id));
      }),
      catchError(() => of([])),
    );
  }

  private loadModules(): void {
    this.modulesLoading.set(true);
    this.modulesError.set('');

    // The workspace may have just bought a module: the refresh makes the
    // backend read the Stripe subscription (it unlocks what was paid), then the
    // account reload gives the app the new modules.
    this.billingApi.refresh().subscribe({
      next: () => this.authService.reloadAccount().subscribe({ error: () => undefined }),
      error: () => undefined,
    });

    this.api
      .getModules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalog) => {
          this.moduleCatalog.set(catalog);
          this.selectedModules.set([]);
          this.modulesLoading.set(false);
        },
        error: () => {
          this.modulesError.set('settings.messages.modulesFailed');
          this.modulesLoading.set(false);
        },
      });
  }

  private moduleErrorKey(error: unknown): string {
    const body = (error as { error?: { code?: string; message?: string } })?.error;
    const code = String(body?.code ?? '').toLowerCase();

    if (code === 'paymentfailed') return 'settings.messages.paymentFailed';
    if (code === 'nosubscription') return 'settings.messages.noSubscription';
    if (code === 'unknownmodule') return 'settings.messages.moduleUnknown';
    if (code === 'modulealreadyactive') return 'settings.messages.moduleAlreadyActive';
    if (code === 'modulealreadypaid') return 'settings.messages.moduleAlreadyPaid';
    if (body?.message) return 'settings.messages.modulesPurchaseFailed';
    return 'settings.messages.modulesFailed';
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

  loadUsers(): void {
    this.api
      .getUsers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (users) => this.users.set(users),
        error: () => this.users.set([]),
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
    if (error.status === 409 && message.includes('subscription already exists')) {
      return 'settings.messages.subscriptionExists';
    }
    return this.fallbackKey(context);
  }

  private fallbackKey(context: ErrorContext): string {
    if (context === 'save') return 'settings.messages.saveFailed';
    return 'settings.messages.billingFailed';
  }
}

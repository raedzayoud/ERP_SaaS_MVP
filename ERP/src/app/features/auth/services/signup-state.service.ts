import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthApiService } from '../../../core/services/auth-api.service';
import {
  BillingInterval,
  SignupDocumentSlot,
  SignupRequestPayload,
} from '../../../core/models/auth';
import {
  ErpApp,
  ERP_APPS,
  getAppById,
  resolveDependencies,
  ERP_SUITES,
  AUTO_BUNDLED_APPS,
  AUTO_BUNDLED_IDS,
} from '../../../core/data/apps';
import { getPlanForModules } from '../../../core/data/plans';
import { Plan } from '../../../core/models/plan';
import { COUNTRIES, LANGUAGES, COMPANY_SIZES } from '../../../core/data/countries';

/** One box in the app grid: "General" (locked dashboard) or a business suite. */
interface AppGroup {
  id: string;
  general: boolean;
  apps: ErpApp[];
}

/**
 * Holds the whole signup wizard state so it survives navigation between
 * /signup (hub) and /signup/apps/:suite (suite pages): the router recreates
 * the component on those routes, but this service lives in the root injector.
 */
@Injectable({ providedIn: 'root' })
export class SignupStateService {
  private authApi = inject(AuthApiService);
  private router = inject(Router);
  private transloco = inject(TranslocoService);

  step = signal(1);
  error = signal('');

  // ── Step 1: app selection ─────────────────────
  selectedApps = signal<string[]>(['dashboard']);
  depNotice = signal('');

  // ── Step 2: details and password ──────────────
  fullName = signal('');
  companyName = signal('');
  subdomain = signal('');
  email = signal('');
  password = signal('');
  showPassword = signal(false);

  // ── Step 3: email verification (OTP) ───────────
  emailVerified = signal(false);
  otpSent = signal(false);
  otpCode = signal('');
  otpSending = signal(false);
  otpVerifying = signal(false);
  otpError = signal('');
  otpInfo = signal('');
  otpResendAfter = signal(0);
  verificationToken = signal('');
  private otpResendTimer: ReturnType<typeof setInterval> | null = null;
  country = signal('TN');
  language = signal('en');
  companySize = signal('1-5');
  subdomainChecked = signal<boolean | null>(null);
  subdomainChecking = signal(false);
  subdomainCheckFailed = signal(false);
  private availabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private availabilityRequestId = 0;

  // ── Step 4: KYC documents ─────────────────────
  readonly docSlots: readonly SignupDocumentSlot[] = [
    'idCardRecto',
    'idCardVerso',
    'tradeRegister',
    'taxRegistration',
  ];
  readonly maxDocSizeKb = 2048;
  private readonly docIcons: Record<string, string> = {
    idCardRecto: '🪪',
    idCardVerso: '🪪',
    tradeRegister: '🏛️',
    taxRegistration: '🧮',
  };
  uploadedDocs = signal<Partial<Record<SignupDocumentSlot, File>>>({});
  docError = signal('');

  /** Matricule fiscal typed at step 4 (kept as text, uppercase). */
  taxId = signal('');
  taxIdTouched = signal(false);

  docsComplete = computed(() =>
    this.docSlots.every((slot) => this.uploadedDocs()[slot] !== undefined),
  );

  /** Step 4 asks for the four KYC files AND the tax number. */
  documentsStepComplete = computed(
    () => this.docsComplete() && this.taxId().trim().length >= 5,
  );

  // ── Step 5: review and payment ─────────────────
  billingInterval = signal<BillingInterval>('MONTHLY');
  submitting = signal(false);

  countries = COUNTRIES;
  languages = LANGUAGES;
  companySizes = COMPANY_SIZES;

  // ── Computed ──────────────────────────────────
  /** Boxes for the hub: General (locked Dashboard) then the business suites. */
  get appGroups(): AppGroup[] {
    const groups: AppGroup[] = [];
    const dashboard = getAppById('dashboard');
    if (dashboard) {
      groups.push({ id: 'general', general: true, apps: [dashboard] });
    }
    for (const suite of ERP_SUITES) {
      const apps = suite.apps
        .map((id) => getAppById(id))
        .filter((app): app is ErpApp => app !== undefined);
      groups.push({ id: suite.id, general: false, apps });
    }
    return groups;
  }

  /** Suites shown as big tiles on the /signup hub (Dashboard excluded). */
  get hubSuites(): AppGroup[] {
    return this.appGroups.filter((group) => !group.general);
  }

  /** Resolves the :suite route parameter, undefined when invalid. */
  resolveSuite(id: string | null | undefined): AppGroup | undefined {
    if (!id) return undefined;
    return this.appGroups.find((group) => group.id === id && !group.general);
  }

  /** The plan must not change because of automatically provisioned apps. */
  selectedPlan = computed<Plan>(() =>
    getPlanForModules(this.selectedApps().filter((id) => !AUTO_BUNDLED_IDS.includes(id))),
  );

  /** Price of the selected plan for the chosen billing interval. */
  selectedPrice = computed(() =>
    this.billingInterval() === 'ANNUAL'
      ? this.selectedPlan().priceAnnual
      : this.selectedPlan().priceMonthly,
  );

  /** Auto-provisioned apps are never a user choice, so not counted. */
  selectableCount = computed(
    () =>
      this.selectedApps().filter(
        (id) => id !== 'dashboard' && !AUTO_BUNDLED_IDS.includes(id),
      ).length,
  );

  selectedLabels = computed(() =>
    this.labelsFor(
      this.selectedApps().filter((id) => !AUTO_BUNDLED_IDS.includes(id)),
    ).replace(/, /g, ' · '),
  );

  formValid = computed(() => {
    return (
      this.fullName().trim().length > 1 &&
      this.companyName().trim().length > 1 &&
      this.email().includes('@') &&
      this.password().length >= 6 &&
      this.subdomain().length >= 3 &&
      this.subdomainChecked() === true
    );
  });

  get fullSubdomain(): string {
    return this.subdomain() ? `${this.subdomain()}.erpcloud.com` : 'yourcompany.erpcloud.com';
  }

  // ══════════════════════════════════════════════
  // Step 1 — App selection
  // ══════════════════════════════════════════════
  isAppSelected(appId: string): boolean {
    return this.selectedApps().includes(appId);
  }

  /** Apps in the current selection that directly depend on the given app. */
  private directSelectedDependents(appId: string): string[] {
    return ERP_APPS.filter(
      (app) =>
        app.dependencies.includes(appId) &&
        this.isAppSelected(app.id) &&
        !AUTO_BUNDLED_IDS.includes(app.id),
    ).map((app) => app.id);
  }

  /** Translated label of the first selected app that requires this one (badge). */
  requiredByLabel(appId: string): string | null {
    const dependent = this.directSelectedDependents(appId)[0];
    return dependent ? this.labelOf(dependent) : null;
  }

  /** "Requires: …" hint shown on cards whose app has prerequisites. */
  requiresLabel(app: ErpApp): string | null {
    if (app.dependencies.length === 0) return null;
    return this.transloco.translate('signup.appStep.requires', {
      list: this.labelsFor(app.dependencies),
    });
  }

  private labelOf(appId: string): string {
    return this.transloco.translate(`apps.items.${appId}.label`);
  }

  toggleApp(app: ErpApp): void {
    if (app.id === 'dashboard') return;

    const current = this.selectedApps();

    if (current.includes(app.id)) {
      // Deselect is blocked while other selected apps need this one.
      const dependents = this.directSelectedDependents(app.id);
      if (dependents.length > 0) {
        this.depNotice.set(
          this.transloco.translate('signup.appStep.blockedBy', {
            app: this.labelOf(app.id),
            dependents: this.labelsFor(dependents),
          }),
        );
        return;
      }

      this.selectedApps.set(
        current.filter(
          (id) => id !== app.id && !(AUTO_BUNDLED_APPS[app.id] ?? []).includes(id),
        ),
      );
      this.depNotice.set('');
      return;
    }

    // Select + add dependencies, plus any automatically provisioned apps.
    const deps = resolveDependencies(app.id, current);
    const bundled = AUTO_BUNDLED_APPS[app.id] ?? [];
    this.selectedApps.set([...current, app.id, ...deps, ...bundled]);
    this.depNotice.set(
      deps.length > 0
        ? this.transloco.translate('signup.appStep.addedBecause', {
            list: this.labelsFor(deps),
            app: this.labelOf(app.id),
          })
        : '',
    );
  }

  /** Tri-state of the master checkbox of a suite box. */
  suiteState(group: AppGroup): 'all' | 'some' | 'none' {
    const selectable = group.apps.filter((app) => app.id !== 'dashboard');
    const selectedCount = selectable.filter((app) => this.isAppSelected(app.id)).length;
    if (selectedCount === 0) return 'none';
    if (selectedCount === selectable.length) return 'all';
    return 'some';
  }

  /** Apps actually selected inside a suite box (for the small counter). */
  suiteCount(group: AppGroup): { selected: number; total: number } {
    const selectable = group.apps.filter((app) => app.id !== 'dashboard');
    return {
      selected: selectable.filter((app) => this.isAppSelected(app.id)).length,
      total: selectable.length,
    };
  }

  /** Master checkbox: select everything in the box, or try to clear it. */
  toggleSuite(group: AppGroup): void {
    if (this.suiteState(group) === 'all') {
      this.clearSuite(group);
    } else {
      this.selectAllInSuite(group);
    }
  }

  private selectAllInSuite(group: AppGroup): void {
    const before = new Set(this.selectedApps());
    let working = [...this.selectedApps()];

    for (const app of group.apps) {
      if (app.id === 'dashboard' || working.includes(app.id)) continue;
      const deps = resolveDependencies(app.id, working);
      const bundled = AUTO_BUNDLED_APPS[app.id] ?? [];
      working = [...working, app.id, ...deps, ...bundled];
    }

    this.selectedApps.set(working);
    this.depNotice.set(
      working.length > before.size
        ? this.transloco.translate('signup.appStep.suiteAdded', {
            list: this.labelsFor(working.filter((id) => !before.has(id))),
          })
        : '',
    );
  }

  private clearSuite(group: AppGroup): void {
    const boxIds = group.apps.map((app) => app.id);
    let working = [...this.selectedApps()];
    const blocked: string[] = [];

    for (const id of boxIds) {
      if (!working.includes(id)) continue;
      const externalDependants = working.filter((candidateId) => {
        if (
          candidateId === id ||
          boxIds.includes(candidateId) ||
          AUTO_BUNDLED_IDS.includes(candidateId)
        ) {
          return false;
        }
        const candidate = getAppById(candidateId);
        return candidate?.dependencies.includes(id) ?? false;
      });

      if (externalDependants.length > 0) {
        blocked.push(id);
        continue;
      }

      working = working.filter(
        (otherId) => otherId !== id && !(AUTO_BUNDLED_APPS[id] ?? []).includes(otherId),
      );
    }

    this.selectedApps.set(working);

    if (blocked.length > 0) {
      const first = blocked[0];
      const externalDependants = this.directSelectedDependents(first);
      this.depNotice.set(
        this.transloco.translate('signup.appStep.blockedBy', {
          app: this.labelOf(first),
          dependents: this.labelsFor(externalDependants),
        }),
      );
    } else {
      this.depNotice.set('');
    }
  }

  private labelsFor(ids: string[]): string {
    return ids
      .map((id) => this.labelOf(id))
      .join(', ');
  }

  /**
   * Returns apps that are required by the current selection but missing.
   * Resolves transitively (e.g. accounting needs invoices, which needs
   * contacts and products).
   */
  private missingDependencies(): string[] {
    const working = [...this.selectedApps()];
    const added: string[] = [];

    let changed = true;
    while (changed) {
      changed = false;
      for (const app of ERP_APPS) {
        if (!working.includes(app.id)) continue;
        for (const dep of app.dependencies) {
          if (!working.includes(dep)) {
            working.push(dep);
            added.push(dep);
            changed = true;
          }
        }
      }
    }

    return added;
  }

  // ══════════════════════════════════════════════
  // Step 2 — Details
  // ══════════════════════════════════════════════
  onFormInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    if (field === 'email') {
      const previous = this.email().trim().toLowerCase();
      const next = value.trim().toLowerCase();
      if (next !== previous) {
        this.resetOtp();
      }
      this.email.set(value);
      return;
    }

    const map: Record<string, (v: string) => void> = {
      fullName: (v) => this.fullName.set(v),
      companyName: (v) => this.companyName.set(v),
    };
    map[field]?.(value);
  }

  sendOtp(): void {
    if (this.otpSending()) return;

    const email = this.email().trim().toLowerCase();
    if (!email.includes('@')) {
      this.otpError.set(this.transloco.translate('signup.verifyStep.errors.email'));
      return;
    }

    this.otpSending.set(true);
    this.otpError.set('');
    this.otpInfo.set('');

    this.authApi.sendSignupOtp(email).subscribe({
      next: (response) => {
        if (this.email().trim().toLowerCase() !== email) return;
        this.otpSending.set(false);
        this.otpSent.set(true);
        this.otpCode.set('');
        this.otpInfo.set(
          this.transloco.translate('signup.verifyStep.codeSent', {
            minutes: response.expiresInMinutes,
          }),
        );
        this.startOtpCooldown(response.resendAfterSeconds);
      },
      error: (error: unknown) => {
        if (this.email().trim().toLowerCase() !== email) return;
        this.otpSending.set(false);
        this.otpError.set(this.otpErrorKey(error));
      },
    });
  }

  verifyOtp(): void {
    if (this.otpVerifying()) return;

    const email = this.email().trim().toLowerCase();
    const code = this.otpCode().trim();
    if (code.length !== 6) {
      this.otpError.set(this.transloco.translate('signup.verifyStep.errors.code'));
      return;
    }

    this.otpVerifying.set(true);
    this.otpError.set('');
    this.otpInfo.set('');

    this.authApi.verifySignupOtp(email, code).subscribe({
      next: (response) => {
        if (this.email().trim().toLowerCase() !== email) return;
        this.otpVerifying.set(false);
        this.emailVerified.set(true);
        this.verificationToken.set(response.verificationToken);
        this.otpInfo.set(this.transloco.translate('signup.verifyStep.verifiedText'));
        this.stopOtpCooldown();
        this.otpResendAfter.set(0);
      },
      error: (error: unknown) => {
        if (this.email().trim().toLowerCase() !== email) return;
        this.otpVerifying.set(false);
        this.otpError.set(this.otpErrorKey(error));
      },
    });
  }

  onOtpCodeInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const code = input.value.replace(/\D/g, '').slice(0, 6);
    this.otpCode.set(code);
    input.value = code;
  }

  resetOtp(): void {
    this.emailVerified.set(false);
    this.otpSent.set(false);
    this.otpCode.set('');
    this.otpSending.set(false);
    this.otpVerifying.set(false);
    this.otpError.set('');
    this.otpInfo.set('');
    this.verificationToken.set('');
    this.stopOtpCooldown();
    this.otpResendAfter.set(0);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  onSubdomainInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    this.subdomain.set(raw);
    this.subdomainChecked.set(null);
    this.subdomainCheckFailed.set(false);
    this.subdomainChecking.set(false);

    if (this.availabilityTimer) {
      clearTimeout(this.availabilityTimer);
      this.availabilityTimer = null;
    }

    const requestId = ++this.availabilityRequestId;
    if (raw.length < 3) return;

    this.subdomainChecking.set(true);
    this.availabilityTimer = setTimeout(() => {
      this.authApi.signupAvailability(raw).subscribe({
        next: (response) => {
          if (requestId !== this.availabilityRequestId) return;
          this.subdomainChecked.set(response.subdomainAvailable);
          this.subdomainChecking.set(false);
        },
        error: () => {
          if (requestId !== this.availabilityRequestId) return;
          this.subdomainChecked.set(null);
          this.subdomainChecking.set(false);
          this.subdomainCheckFailed.set(true);
        },
      });
    }, 350);
  }

  onSelectChange(field: string, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const map: Record<string, (v: string) => void> = {
      country: (v) => this.country.set(v),
      language: (v) => this.language.set(v),
      companySize: (v) => this.companySize.set(v),
    };
    map[field]?.(value);
  }

  // ══════════════════════════════════════════════
  // Step 3 — KYC documents
  // ══════════════════════════════════════════════
  docIcon(slot: string): string {
    return this.docIcons[slot] ?? '📄';
  }

  docSizeKb(file: File): number {
    return Math.max(1, Math.round(file.size / 1024));
  }

  onDocPick(slot: SignupDocumentSlot, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      this.docError.set(this.transloco.translate('signup.docStep.errors.type'));
      input.value = '';
      return;
    }
    if (file.size > this.maxDocSizeKb * 1024) {
      this.docError.set(
        this.transloco.translate('signup.docStep.errors.tooLarge', {
          size: this.maxDocSizeKb,
        }),
      );
      input.value = '';
      return;
    }

    this.uploadedDocs.update((docs) => ({ ...docs, [slot]: file }));
    this.docError.set('');
    input.value = '';
  }

  removeDoc(slot: SignupDocumentSlot): void {
    this.uploadedDocs.update((docs) => {
      const next = { ...docs };
      delete next[slot];
      return next;
    });
  }

  /** Keeps only matricule-fiscal-like characters, uppercased. */
  onTaxIdInput(event: Event): void {
    this.taxIdTouched.set(true);
    const raw = (event.target as HTMLInputElement).value.toUpperCase();
    this.taxId.set(raw.replace(/[^A-Z0-9/-]/g, '').slice(0, 30));
  }

  // ══════════════════════════════════════════════
  // Step 5 — Review and submit
  // ══════════════════════════════════════════════
  setBillingInterval(interval: BillingInterval): void {
    this.billingInterval.set(interval);
  }

  submit(): void {
    if (this.submitting()) return;
    this.error.set('');

    if (!this.formValid()) {
      this.error.set(this.transloco.translate('signup.detailsStep.invalid'));
      this.step.set(2);
      return;
    }
    if (!this.emailVerified()) {
      this.error.set(this.transloco.translate('signup.verifyStep.errors.required'));
      this.step.set(3);
      return;
    }
    if (!this.documentsStepComplete()) {
      this.error.set(this.transloco.translate('signup.docStep.errors.missing'));
      this.step.set(4);
      return;
    }

    this.submitting.set(true);
    this.authApi.signup(this.buildPayload(), this.documentMap()).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.password.set('');

        if (response.checkoutUrl) {
          window.location.assign(response.checkoutUrl);
          return;
        }

        void this.router.navigate(['/signup/success'], {
          queryParams: { trial: 1 },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.error.set(this.signupErrorKey(error));
      },
    });
  }

  private buildPayload(): SignupRequestPayload {
    return {
      fullName: this.fullName().trim(),
      companyName: this.companyName().trim(),
      subdomain: this.subdomain(),
      email: this.email().trim().toLowerCase(),
      password: this.password(),
      country: this.country(),
      language: this.language(),
      companySize: this.companySize(),
      taxId: this.taxId(),
      modules: [...this.selectedApps()],
      planId: this.selectedPlan().id,
      billingInterval: this.billingInterval(),
      verificationToken: this.verificationToken(),
    };
  }

  private documentMap(): Record<SignupDocumentSlot, File> {
    return this.uploadedDocs() as Record<SignupDocumentSlot, File>;
  }

  private signupErrorKey(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'signup.errors.generic';
    }
    if (error.status === 0) {
      return 'signup.errors.network';
    }

    const message = String(error.error?.message ?? '').toLowerCase();
    if (message.includes('email already in use')) {
      return 'signup.errors.emailUsed';
    }
    if (message.includes('subdomain not available')) {
      return 'signup.errors.subdomainTaken';
    }
    if (message.includes('billing is not configured')) {
      return 'signup.errors.billingNotConfigured';
    }
    if (message.includes('payment provider')) {
      return 'signup.errors.payment';
    }
    if (message.includes('email verification required or expired')) {
      return 'signup.verifyStep.errors.expired';
    }
    if (error.status === 400) {
      return 'signup.errors.invalid';
    }
    return 'signup.errors.generic';
  }

  private otpErrorKey(error: unknown): string {
    if (!(error instanceof HttpErrorResponse)) {
      return 'signup.verifyStep.errors.send';
    }
    if (error.status === 0) {
      return 'signup.errors.network';
    }

    const message = String(error.error?.message ?? '').toLowerCase();
    if (message.includes('email already in use')) {
      return 'signup.errors.emailUsed';
    }
    if (message.includes('please wait')) {
      return 'signup.verifyStep.errors.cooldown';
    }
    if (message.includes('too many attempts')) {
      return 'signup.verifyStep.errors.tooMany';
    }
    if (message.includes('expired') || message.includes('no verification code')) {
      return 'signup.verifyStep.errors.expired';
    }
    if (message.includes('incorrect verification code')) {
      return 'signup.verifyStep.errors.wrong';
    }
    if (message.includes('could not send verification email')) {
      return 'signup.verifyStep.errors.mail';
    }
    return 'signup.verifyStep.errors.send';
  }

  private startOtpCooldown(seconds: number): void {
    this.stopOtpCooldown();
    this.otpResendAfter.set(Math.max(0, Math.ceil(seconds)));
    if (this.otpResendAfter() === 0) return;

    this.otpResendTimer = setInterval(() => {
      const next = this.otpResendAfter() - 1;
      this.otpResendAfter.set(Math.max(0, next));
      if (next <= 0) {
        this.stopOtpCooldown();
      }
    }, 1000);
  }

  private stopOtpCooldown(): void {
    if (this.otpResendTimer) {
      clearInterval(this.otpResendTimer);
      this.otpResendTimer = null;
    }
  }

  // ══════════════════════════════════════════════
  // Navigation
  // ══════════════════════════════════════════════
  next(): void {
    this.error.set('');

    if (this.step() === 1) {
      if (this.selectableCount() < 1) {
        this.error.set(this.transloco.translate('signup.appStep.requireAtLeastOne'));
        return;
      }

      const missing = this.missingDependencies();
      if (missing.length > 0) {
        this.selectedApps.set([...new Set([...this.selectedApps(), ...missing])]);
        this.depNotice.set(
          this.transloco.translate('signup.appStep.addedBecause', {
            list: this.labelsFor(missing),
            app: this.labelOf(missing[0]),
          }),
        );
      }

      // Leave the suite URL behind: later steps live on /signup.
      void this.router.navigate(['/signup']);
      this.step.set(2);
      return;
    }

    if (this.step() === 2) {
      if (!this.formValid()) {
        this.error.set(this.transloco.translate('signup.detailsStep.invalid'));
        return;
      }
      this.step.set(3);
      if (!this.otpSent() && !this.emailVerified()) {
        this.sendOtp();
      }
      return;
    }

    if (this.step() === 3) {
      if (!this.emailVerified()) {
        this.error.set(this.transloco.translate('signup.verifyStep.errors.required'));
        return;
      }
      this.step.set(4);
      return;
    }

    if (this.step() === 4) {
      if (!this.docsComplete()) {
        this.error.set(this.transloco.translate('signup.docStep.errors.missing'));
        return;
      }
      if (this.taxId().trim().length < 5) {
        this.error.set(this.transloco.translate('signup.docStep.errors.taxIdMissing'));
        return;
      }
      this.step.set(5);
    }
  }

  back(): void {
    this.error.set('');
    if (this.step() > 1) {
      this.step.update((step) => step - 1);
    }
  }
}

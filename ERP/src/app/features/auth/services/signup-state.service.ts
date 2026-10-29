import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../../core/services/auth.service';
import { TenantService } from '../../../core/services/tenant.service';
import { PlatformService } from '../../admin/services/platform.service';
import type { SignupRequestDocuments } from '../../admin/models/platform';
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

/** A KYC file chosen by the company during the wizard. */
interface UploadedKycDoc {
  fileName: string;
  sizeKb: number;
  /** Kept only for small images so the super-admin console can show it. */
  dataUrl?: string;
}

/**
 * Holds the whole signup wizard state so it survives navigation between
 * /signup (hub) and /signup/apps/:suite (suite pages): the router recreates
 * the component on those routes, but this service lives in the root injector.
 */
@Injectable({ providedIn: 'root' })
export class SignupStateService {
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  private platformService = inject(PlatformService);
  private router = inject(Router);
  private transloco = inject(TranslocoService);

  step = signal(1);
  error = signal('');

  // ── Step 1: app selection ─────────────────────
  selectedApps = signal<string[]>(['dashboard']);
  depNotice = signal('');

  // ── Step 2: form ──────────────────────────────
  fullName = signal('');
  companyName = signal('');
  subdomain = signal('');
  email = signal('');
  country = signal('TN');
  language = signal('en');
  companySize = signal('1-5');
  subdomainChecked = signal<boolean | null>(null);

  // ── Step 3: KYC documents ─────────────────────
  readonly docSlots = ['idCard', 'tradeRegister', 'taxRegistration'] as const;
  readonly maxDocSizeKb = 2048;
  private readonly docIcons: Record<string, string> = {
    idCard: '🪪',
    tradeRegister: '🏛️',
    taxRegistration: '🧮',
  };
  uploadedDocs = signal<Partial<Record<string, UploadedKycDoc>>>({});
  docError = signal('');

  docsComplete = computed(() =>
    this.docSlots.every((slot) => this.uploadedDocs()[slot] !== undefined),
  );

  // ── Step 4: email verification ────────────────
  verificationCode = signal('');
  codeInput = signal('');
  codeSentAt = signal(0);
  resendCooldown = signal(0);
  verifyAttempts = signal(0);
  verifyError = signal('');
  private codeTimer: ReturnType<typeof setInterval> | null = null;
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  // ── Step 5: payment (Stripe-style demo form) ──
  cardNumber = signal('');
  cardExpiry = signal('');
  cardCvc = signal('');
  cardName = signal('');
  paymentError = signal('');
  paying = signal(false);

  // ── Step 6: provisioning ──────────────────────
  provisioningStep = signal(0);
  private provisionTimers: ReturnType<typeof setTimeout>[] = [];

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
      this.subdomain().length >= 3 &&
      this.subdomainChecked() === true
    );
  });

  canVerify = computed(
    () => this.codeInput().length === 6 && this.codeInput() === this.verificationCode(),
  );

  get codeExpired(): boolean {
    if (!this.codeSentAt()) return false;
    return Date.now() - this.codeSentAt() > 5 * 60 * 1000;
  }

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
  // Step 2 — Form
  // ══════════════════════════════════════════════
  onFormInput(field: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    const map: Record<string, (v: string) => void> = {
      fullName: (v) => this.fullName.set(v),
      companyName: (v) => this.companyName.set(v),
      email: (v) => this.email.set(v),
    };
    map[field]?.(value);
  }

  onSubdomainInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    this.subdomain.set(raw);
    this.subdomainChecked.set(null);
    if (raw.length >= 3) {
      this.subdomainChecked.set(this.tenantService.isSubdomainAvailable(raw));
    }
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

  /** Stores the chosen file: small images keep a preview for the console. */
  onDocPick(slot: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    const sizeKb = Math.max(1, Math.round(file.size / 1024));

    if (sizeKb > this.maxDocSizeKb) {
      this.docError.set(
        this.transloco.translate('signup.docStep.errors.tooLarge', { size: this.maxDocSizeKb }),
      );
      input.value = '';
      return;
    }
    if (!allowed) {
      this.docError.set(this.transloco.translate('signup.docStep.errors.type'));
      input.value = '';
      return;
    }

    const entry: UploadedKycDoc = { fileName: file.name, sizeKb };
    const keepImage = file.type.startsWith('image/') && sizeKb <= 200;

    const done = (result: UploadedKycDoc) => {
      this.uploadedDocs.update((docs) => ({ ...docs, [slot]: result }));
      this.docError.set('');
    };

    if (!keepImage) {
      done(entry);
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => done({ ...entry, dataUrl: String(reader.result) });
    reader.onerror = () => {
      this.docError.set(this.transloco.translate('signup.docStep.errors.read'));
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  removeDoc(slot: string): void {
    this.uploadedDocs.update((docs) => {
      const next = { ...docs };
      delete next[slot];
      return next;
    });
  }

  /** Builds the request history kept by the super-admin console. */
  private documentsForRequest(): SignupRequestDocuments {
    return {
      idCard: this.docEntry('idCard'),
      tradeRegister: this.docEntry('tradeRegister'),
      taxRegistration: this.docEntry('taxRegistration'),
    };
  }

  private docEntry(slot: string): SignupRequestDocuments['idCard'] {
    const uploaded = this.uploadedDocs()[slot];
    return uploaded ? { kind: 'uploaded', ...uploaded } : { kind: 'submitted' };
  }

  // ══════════════════════════════════════════════
  // Step 4 — Email verification
  // ══════════════════════════════════════════════
  private startVerification(): void {
    this.generateCode();
    this.verifyAttempts.set(0);
    this.verifyError.set('');
    this.codeInput.set('');
    this.startResendCooldown(60);
  }

  private generateCode(): void {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    this.verificationCode.set(code);
    this.codeSentAt.set(Date.now());
  }

  private startResendCooldown(seconds: number): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendCooldown.set(seconds);
    this.resendTimer = setInterval(() => {
      const next = this.resendCooldown() - 1;
      this.resendCooldown.set(next);
      if (next <= 0 && this.resendTimer) {
        clearInterval(this.resendTimer);
        this.resendTimer = null;
      }
    }, 1000);
  }

  resendCode(): void {
    if (this.resendCooldown() > 0) return;
    this.generateCode();
    this.verifyError.set('');
    this.codeInput.set('');
    this.startResendCooldown(60);
  }

  onCodeInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value
      .replace(/\D/g, '')
      .slice(0, 6);
    this.codeInput.set(value);
  }

  verifyCode(): void {
    this.verifyError.set('');

    if (this.codeExpired) {
      this.verifyError.set(this.transloco.translate('signup.verifyStep.errors.expired'));
      return;
    }

    if (this.codeInput() === this.verificationCode()) {
      this.error.set('');
      this.paymentError.set('');
      this.step.set(5);
    } else {
      this.verifyAttempts.update((n) => n + 1);
      this.verifyError.set(this.transloco.translate('signup.verifyStep.errors.wrong'));
      if (this.verifyAttempts() >= 5) {
        this.verifyError.set(this.transloco.translate('signup.verifyStep.errors.tooMany'));
        this.resendCooldown.set(0);
      }
    }
  }

  // ══════════════════════════════════════════════
  // Step 5 — Payment (Stripe-style demo)
  // ══════════════════════════════════════════════
  get cardDigits(): string {
    return this.cardNumber().replace(/\D/g, '');
  }

  get cardBrand(): string {
    const digits = this.cardDigits;
    if (/^4/.test(digits)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'MASTERCARD';
    if (/^3[47]/.test(digits)) return 'AMEX';
    return 'CARD';
  }

  onCardNumberInput(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 19);
    this.cardNumber.set(digits.replace(/(\d{4})(?=\d)/g, '$1 '));
    this.paymentError.set('');
  }

  onCardExpiryInput(event: Event): void {
    let digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      digits = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    this.cardExpiry.set(digits);
    this.paymentError.set('');
  }

  onCardCvcInput(event: Event): void {
    const digits = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
    this.cardCvc.set(digits);
    this.paymentError.set('');
  }

  onCardNameInput(event: Event): void {
    this.cardName.set((event.target as HTMLInputElement).value);
    this.paymentError.set('');
  }

  pay(): void {
    this.paymentError.set('');
    const digits = this.cardDigits;

    if (!this.cardName().trim()) {
      this.paymentError.set(this.transloco.translate('signup.paymentStep.errors.name'));
      return;
    }
    if ((digits.length !== 15 && digits.length !== 16) || !this.luhnValid(digits)) {
      this.paymentError.set(this.transloco.translate('signup.paymentStep.errors.card'));
      return;
    }
    if (!this.expiryValid()) {
      this.paymentError.set(this.transloco.translate('signup.paymentStep.errors.expiry'));
      return;
    }
    if (this.cardCvc().length < 3) {
      this.paymentError.set(this.transloco.translate('signup.paymentStep.errors.cvc'));
      return;
    }

    this.paying.set(true);
    const t = setTimeout(() => {
      this.paying.set(false);
      this.goToProvisioning();
    }, 1200);
    this.provisionTimers.push(t);
  }

  private luhnValid(digits: string): boolean {    let sum = 0;
    let double = false;

    for (let i = digits.length - 1; i >= 0; i--) {
      let n = digits.charCodeAt(i) - 48;
      if (double) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      double = !double;
    }

    return sum % 10 === 0;
  }

  private expiryValid(): boolean {
    const [month, year] = this.cardExpiry().split('/');
    if (!month || !year || month.length !== 2 || year.length !== 2) return false;

    const m = Number(month);
    const y = Number(year);
    if (!Number.isInteger(m) || !Number.isInteger(y) || m < 1 || m > 12) return false;

    const now = new Date();
    const currentYear = now.getFullYear() % 100;
    const currentMonth = now.getMonth() + 1;
    return y > currentYear || (y === currentYear && m >= currentMonth);
  }

  // ══════════════════════════════════════════════
  // Step 6 — Provisioning
  // ══════════════════════════════════════════════
  private goToProvisioning(): void {
    if (this.codeTimer) clearInterval(this.codeTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.step.set(6);
    this.provisioningStep.set(0);
    this.runProvisioning();
  }

  private runProvisioning(): void {
    const totalSteps = 5;
    const stepDelay = 500;
    const tick = () => {
      this.provisioningStep.update((n) => n + 1);
      if (this.provisioningStep() < totalSteps) {
        const t = setTimeout(tick, stepDelay);
        this.provisionTimers.push(t);
      } else {
        const t = setTimeout(() => this.finishProvisioning(), stepDelay);
        this.provisionTimers.push(t);
      }
    };

    const start = setTimeout(tick, 400);
    this.provisionTimers.push(start);
  }

  /** Localized provisioning checklist rendered in step 6. */
  provisionItems(): { key: string; params: Record<string, unknown> }[] {
    return [
      { key: 'signup.setupStep.item1', params: {} },
      { key: 'signup.setupStep.item2', params: { subdomain: this.fullSubdomain } },
      { key: 'signup.setupStep.item3', params: {} },
      { key: 'signup.setupStep.item4', params: { count: this.selectedApps().length } },
      { key: 'signup.setupStep.item5', params: {} },
      { key: 'signup.setupStep.item6', params: {} },
    ];
  }

  private finishProvisioning(): void {
    const success = this.authService.signup({
      fullName: this.fullName(),
      companyName: this.companyName(),
      subdomain: this.subdomain(),
      email: this.email(),
      country: this.country(),
      language: this.language(),
      companySize: this.companySize(),
      modules: this.selectedApps(),
    });

    if (success) {
      // The console keeps a trace of the registration with its KYC files.
      this.platformService
        .createSignupRequest({
          companyName: this.companyName(),
          subdomain: this.subdomain(),
          email: this.email(),
          country: this.country(),
          planId: this.selectedPlan().id,
          documents: this.documentsForRequest(),
          decisionNote: this.transloco.translate('signup.request.autoApprovedNote'),
        })
        .subscribe();

      this.router.navigate(['/dashboard']);
    } else {
      this.error.set(this.transloco.translate('signup.error.generic'));
      this.step.set(1);
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
      this.router.navigate(['/signup']);
      this.step.set(2);
      return;
    }

    if (this.step() === 2) {
      if (!this.formValid()) {
        this.error.set(this.transloco.translate('signup.detailsStep.invalid'));
        return;
      }
      this.step.set(3);
      return;
    }

    if (this.step() === 3) {
      if (!this.docsComplete()) {
        this.error.set(this.transloco.translate('signup.docStep.errors.missing'));
        return;
      }
      this.startVerification();
      this.step.set(4);
      return;
    }
  }

  back(): void {
    this.error.set('');
    if (this.step() > 1 && this.step() < 6) {
      this.step.update((s) => s - 1);
    }
  }

  /** Stops every pending timer. Called from the component's ngOnDestroy. */
  cleanupTimers(): void {
    if (this.codeTimer) clearInterval(this.codeTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
    for (const t of this.provisionTimers) clearTimeout(t);
  }
}

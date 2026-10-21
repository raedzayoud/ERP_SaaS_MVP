import { Component, signal, computed, inject, OnDestroy } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import {
  ErpApp,
  ERP_APPS,
  getAppsByCategory,
  resolveDependencies,
  resolveDependents,
} from '../../../../core/data/apps';
import { getPlanForModules } from '../../../../core/data/plans';
import { Plan } from '../../../../core/models/plan';
import { COUNTRIES, LANGUAGES, COMPANY_SIZES } from '../../../../core/data/countries';

@Component({
  selector: 'app-signup',
  imports: [RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class SignupComponent implements OnDestroy {
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);
  private router = inject(Router);

  step = signal(1);
  error = signal('');

  // ── Step 1: app selection ─────────────────────
  appCategories = getAppsByCategory();
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

  // ── Step 3: email verification ────────────────
  verificationCode = signal('');
  codeInput = signal('');
  codeSentAt = signal(0);
  resendCooldown = signal(0);
  verifyAttempts = signal(0);
  verifyError = signal('');
  private codeTimer: ReturnType<typeof setInterval> | null = null;
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  // ── Step 4: provisioning ──────────────────────
  provisioningStep = signal(0);
  private provisionTimers: ReturnType<typeof setTimeout>[] = [];

  countries = COUNTRIES;
  languages = LANGUAGES;
  companySizes = COMPANY_SIZES;

  // ── Computed ──────────────────────────────────
  selectedPlan = computed<Plan>(() =>
    getPlanForModules(this.selectedApps()),
  );

  selectableCount = computed(
    () => this.selectedApps().filter((id) => id !== 'dashboard').length,
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

  toggleApp(app: ErpApp): void {
    if (app.id === 'dashboard') return;

    const current = this.selectedApps();

    if (current.includes(app.id)) {
      // Deselect + cascade-remove dependents
      const toRemove = resolveDependents(app.id, current);
      const removed = current.filter(
        (id) => id === app.id || toRemove.includes(id),
      );
      this.selectedApps.set(current.filter((id) => !removed.includes(id)));
      this.depNotice.set(
        removed.length > 1
          ? `Removed: ${this.labelsFor(removed)} (depends on ${app.label})`
          : '',
      );
    } else {
      // Select + add dependencies
      const deps = resolveDependencies(app.id, current);
      this.selectedApps.set([...current, app.id, ...deps]);
      this.depNotice.set(
        deps.length > 0
          ? `Added: ${this.labelsFor(deps)} (required by ${app.label})`
          : '',
      );
    }
  }

  private labelsFor(ids: string[]): string {
    return ids
      .map((id) => ERP_APPS.find((a) => a.id === id)?.label || id)
      .join(', ');
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
  // Step 3 — Email verification
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
      this.verifyError.set('Code expired. Please resend a new code.');
      return;
    }

    if (this.codeInput() === this.verificationCode()) {
      this.goToProvisioning();
    } else {
      this.verifyAttempts.update((n) => n + 1);
      this.verifyError.set('Incorrect code. Please try again.');
      if (this.verifyAttempts() >= 5) {
        this.verifyError.set('Too many attempts. Please resend a new code.');
        this.resendCooldown.set(0);
      }
    }
  }

  // ══════════════════════════════════════════════
  // Step 4 — Provisioning
  // ══════════════════════════════════════════════
  private goToProvisioning(): void {
    if (this.codeTimer) clearInterval(this.codeTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.step.set(4);
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
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set('Something went wrong. Please try again.');
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
        this.error.set('Please select at least one application.');
        return;
      }
      this.step.set(2);
      return;
    }

    if (this.step() === 2) {
      if (!this.formValid()) {
        this.error.set('Please fill in all fields correctly.');
        return;
      }
      this.startVerification();
      this.step.set(3);
      return;
    }
  }

  back(): void {
    this.error.set('');
    if (this.step() > 1 && this.step() < 4) {
      this.step.update((s) => s - 1);
    }
  }

  ngOnDestroy(): void {
    if (this.codeTimer) clearInterval(this.codeTimer);
    if (this.resendTimer) clearInterval(this.resendTimer);
    for (const t of this.provisionTimers) clearTimeout(t);
  }
}

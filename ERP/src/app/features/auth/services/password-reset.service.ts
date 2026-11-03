import { Injectable, inject } from '@angular/core';
import { MockMailService } from '../../../core/services/mock-mail.service';
import { DEMO_USERS } from '../../../core/data/demo-users';
import { TenantService } from '../../../core/services/tenant.service';
import { safeStorage } from '../../../core/utils/safe-storage';

interface ResetRequest {
  email: string;
  code: string;
  expiresAt: number;
}

/**
 * Demo-only password reset: generates a 6-digit code valid 15 minutes,
 * "sends" it through the MockMailService and keeps the request in
 * localStorage. No real e-mail ever leaves the browser.
 */
@Injectable({ providedIn: 'root' })
export class PasswordResetService {
  private readonly mail = inject(MockMailService);
  private readonly tenantService = inject(TenantService);
  private readonly requestsKey = 'erp_reset_requests';
  private readonly overridesKey = 'erp_password_overrides';

  /** True when the email belongs to a demo account or a workspace member. */
  accountExists(email: string): boolean {
    const lower = email.trim().toLowerCase();
    if (DEMO_USERS.some((user) => user.email === lower)) return true;
    return this.findMember(lower) !== null;
  }

  /**
   * Creates a reset request and sends the demo e-mail.
   * Returns the generated code (the demo screen displays it) or null
   * when no account matches the email.
   */
  requestCode(email: string): string | null {
    const lower = email.trim().toLowerCase();
    if (!this.accountExists(lower)) return null;

    const code = this.randomCode();
    const request: ResetRequest = {
      email: lower,
      code,
      expiresAt: Date.now() + 15 * 60 * 1000,
    };
    this.saveRequest(request);

    this.mail.send({
      to: lower,
      subject: 'ERP Cloud — reset your password',
      body:
        `Your password reset code is: ${code}\n\n` +
        `It expires in 15 minutes.\n` +
        `If you did not request this, you can ignore this e-mail.`,
    });

    return code;
  }

  /**
   * Checks the code for this email and applies the new password.
   * Workspace members keep the password in their tenant; demo accounts
   * get a stored override honoured by AuthService at login.
   * Returns 'ok', 'unknown', 'bad-code' or 'expired'.
   */
  applyPassword(email: string, code: string, newPassword: string): string {
    const lower = email.trim().toLowerCase();
    const request = this.loadRequest(lower);

    if (!request) return 'unknown';
    if (request.code !== code.trim()) return 'bad-code';
    if (request.expiresAt <= Date.now()) {
      this.removeRequest(lower);
      return 'expired';
    }

    const member = this.findMember(lower);
    if (member) {
      this.tenantService.setUserPassword(member.id, newPassword);
    } else {
      this.saveOverride(lower, newPassword);
    }

    this.removeRequest(lower);
    return 'ok';
  }

  /** Password chosen on the reset page for a demo account, if any. */
  getOverride(email: string): string | null {
    const all = this.loadMap<string>(this.overridesKey);
    return all[email.trim().toLowerCase()] ?? null;
  }

  private findMember(email: string): { id: number } | null {
    const users = this.tenantService.currentTenant()?.users ?? [];
    const member = users.find((user) => user.email.toLowerCase() === email);
    return member ? { id: member.id } : null;
  }

  private randomCode(): string {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return String(bytes[0] % 1000000).padStart(6, '0');
  }

  private loadRequest(email: string): ResetRequest | null {
    const all = this.loadMap<ResetRequest>(this.requestsKey);
    return all[email] ?? null;
  }

  private saveRequest(request: ResetRequest): void {
    const all = this.loadMap<ResetRequest>(this.requestsKey);
    all[request.email] = request;
    safeStorage()?.setItem(this.requestsKey, JSON.stringify(all));
  }

  private removeRequest(email: string): void {
    const all = this.loadMap<ResetRequest>(this.requestsKey);
    delete all[email];
    safeStorage()?.setItem(this.requestsKey, JSON.stringify(all));
  }

  private saveOverride(email: string, password: string): void {
    const all = this.loadMap<string>(this.overridesKey);
    all[email] = password;
    safeStorage()?.setItem(this.overridesKey, JSON.stringify(all));
  }

  private loadMap<T>(key: string): Record<string, T> {
    const data = safeStorage()?.getItem(key);
    if (data) {
      try {
        return JSON.parse(data) as Record<string, T>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

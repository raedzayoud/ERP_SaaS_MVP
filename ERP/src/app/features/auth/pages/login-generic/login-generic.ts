import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { AuditService } from '../../../../core/services/audit.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { DEMO_USERS } from '../../../../core/data/demo-users';
import { homeRouteForRole } from '../../../../core/models/role';

/**
 * One single email entry point for every profile: workspace members created
 * by the admin, demo accounts and the platform administrator. A member with
 * a pending renewal is sent to /renew-password before entering the workspace.
 */
@Component({
  selector: 'app-login-generic',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './login-generic.html',
  styleUrl: './login-generic.css',
})
export class LoginGeneric {
  private readonly authService = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly audit = inject(AuditService);
  private readonly router = inject(Router);

  email = signal('');
  password = signal('');
  errorKey = signal('');
  loading = signal(false);

  onSubmit(event: Event): void {
    event.preventDefault();
    this.errorKey.set('');

    const email = this.email().trim().toLowerCase();
    if (!email || !this.password()) {
      this.errorKey.set('login.credentials.missing');
      return;
    }

    if (this.loginWorkspaceMember(email)) return;
    if (this.loginDemoAccount(email)) return;

    this.errorKey.set('rbac.login.invalid');
  }

  /** Members designed by the company administrator in Settings > Users. */
  private loginWorkspaceMember(email: string): boolean {
    const member = this.tenantService
      .currentTenant()
      ?.users.find((user) => user.email.toLowerCase() === email);

    if (!member) return false;

    if (member.active === false) {
      this.errorKey.set('rbac.login.activate');
      return true;
    }

    if (member.password && member.password !== this.password()) {
      this.errorKey.set('rbac.login.invalid');
      return true;
    }

    if (!this.authService.loginAsTenantUser(email, this.password())) {
      this.errorKey.set('rbac.login.invalid');
      return true;
    }

    this.finishLogin();
    return true;
  }

  /** Platform demo accounts (also visible on the role-based login page). */
  private loginDemoAccount(email: string): boolean {
    const demo = DEMO_USERS.find((user) => user.email.toLowerCase() === email);
    if (!demo) return false;

    if (!this.authService.loginWithCredentials(demo.role, email, this.password())) {
      this.errorKey.set('rbac.login.invalid');
      return true;
    }

    this.finishLogin();
    return true;
  }

  private finishLogin(): void {
    const session = this.authService.currentUser();
    if (!session) {
      this.errorKey.set('rbac.login.invalid');
      return;
    }

    this.audit.log('settings', 'login', `${session.name} (${session.email})`);
    this.router.navigate([
      session.mustRenewPassword ? '/renew-password' : homeRouteForRole(session.role),
    ]);
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }
}

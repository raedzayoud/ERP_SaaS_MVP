import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { AuditService } from '../../../../core/services/audit.service';
import { homeRouteForRole } from '../../../../core/models/role';

/**
 * Forced password renewal: members flagged "must renew" by their admin
 * land here after login and cannot enter the workspace before saving.
 */
@Component({
  selector: 'app-renew-password',
  imports: [TranslocoDirective],
  templateUrl: './renew-password.html',
  styleUrl: './renew-password.css',
})
export class RenewPassword {
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);
  private readonly router = inject(Router);

  readonly session = this.authService.currentUser;

  newPassword = signal('');
  confirm = signal('');
  errorKey = signal('');
  saving = signal(false);

  constructor() {
    // Safety net: visitors without a session go back to the generic login.
    if (!this.authService.currentUser()) {
      this.router.navigate(['/login/email']);
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.errorKey.set('');

    if (this.newPassword().length < 6) {
      this.errorKey.set('rbac.renewal.minLength');
      return;
    }
    if (this.newPassword() !== this.confirm()) {
      this.errorKey.set('rbac.renewal.mismatch');
      return;
    }

    this.saving.set(true);
    const saved = this.authService.renewPassword(this.newPassword());
    this.saving.set(false);

    if (!saved) {
      this.errorKey.set('rbac.renewal.minLength');
      return;
    }

    this.audit.log('settings', 'update', 'Password renewed after admin request');
    this.router.navigate([homeRouteForRole(this.authService.currentUser()?.role ?? 'commercial')]);
  }

  onNewPasswordInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
  }

  onConfirmInput(event: Event): void {
    this.confirm.set((event.target as HTMLInputElement).value);
  }
}

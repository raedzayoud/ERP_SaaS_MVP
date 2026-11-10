import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { AuditService } from '../../../../core/services/audit.service';

@Component({
  selector: 'app-login-generic',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './login-generic.html',
  styleUrl: './login-generic.css',
})
export class LoginGeneric {
  private readonly authService = inject(AuthService);
  private readonly audit = inject(AuditService);
  private readonly router = inject(Router);

  email = signal('');
  password = signal('');
  errorKey = signal('');
  loading = signal(false);

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading()) return;

    this.errorKey.set('');

    const email = this.email().trim().toLowerCase();
    if (!email || !this.password()) {
      this.errorKey.set('login.credentials.missing');
      return;
    }

    this.loading.set(true);
    this.authService.login(email, this.password()).subscribe({
      next: (user) => {
        this.loading.set(false);
        this.audit.log('settings', 'login', `${user.name} (${user.email})`);
        void this.router.navigate([
          user.mustRenewPassword ? '/renew-password' : this.authService.homeRouteForCurrentUser(),
        ]);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.errorKey.set(this.loginErrorKey(error));
      },
    });
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }

  private loginErrorKey(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) return 'rbac.login.invalid';
      if (error.status === 403) {
        const message = String(error.error?.message ?? '').toLowerCase();
        if (message.includes('trial')) return 'rbac.login.trialEnded';
        return message.includes('suspended')
          ? 'rbac.login.suspended'
          : 'rbac.login.activate';
      }
      if (error.status === 0) return 'rbac.login.network';
    }
    return 'rbac.login.generic';
  }
}

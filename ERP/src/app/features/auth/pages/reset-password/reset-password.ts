import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { PasswordResetService } from '../../services/password-reset.service';

/**
 * Step 2 of the demo password reset: the visitor enters the 6-digit code
 * received by e-mail and chooses a new password. On success the new
 * password becomes the only one accepted at login.
 */
@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly resetService = inject(PasswordResetService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  email = signal('');
  code = signal('');
  newPassword = signal('');
  confirm = signal('');
  errorKey = signal('');
  saving = signal(false);
  showPassword = signal(false);
  done = signal(false);

  constructor() {
    const prefilled = this.route.snapshot.queryParamMap.get('email');
    if (prefilled) {
      this.email.set(prefilled.trim().toLowerCase());
    }
  }

  /** Live check shown under the password fields. */
  get lengthOk(): boolean {
    return this.newPassword().length >= 6;
  }

  /** Live check shown under the password fields. */
  get matchOk(): boolean {
    return this.newPassword().length > 0 && this.newPassword() === this.confirm();
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.errorKey.set('');

    const email = this.email().trim().toLowerCase();
    const code = this.code().trim();

    if (!email || !code) {
      this.errorKey.set('login.credentials.missing');
      return;
    }
    if (!this.lengthOk) {
      this.errorKey.set('reset.minLength');
      return;
    }
    if (!this.matchOk) {
      this.errorKey.set('reset.mismatch');
      return;
    }

    this.saving.set(true);
    const result = this.resetService.applyPassword(email, code, this.newPassword());
    this.saving.set(false);

    if (result === 'unknown') {
      this.errorKey.set('forgot.unknown');
      return;
    }
    if (result === 'bad-code') {
      this.errorKey.set('reset.invalidCode');
      return;
    }
    if (result === 'expired') {
      this.errorKey.set('reset.expired');
      return;
    }

    this.done.set(true);
  }

  /** Requests a fresh code when the current one expired. */
  goToNewCode(): void {
    this.router.navigate(['/forgot-password'], {
      queryParams: { email: this.email() },
    });
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onCodeInput(event: Event): void {
    this.code.set((event.target as HTMLInputElement).value);
  }

  onNewPasswordInput(event: Event): void {
    this.newPassword.set((event.target as HTMLInputElement).value);
  }

  onConfirmInput(event: Event): void {
    this.confirm.set((event.target as HTMLInputElement).value);
  }

  onToggleShow(event: Event): void {
    this.showPassword.set((event.target as HTMLInputElement).checked);
  }
}

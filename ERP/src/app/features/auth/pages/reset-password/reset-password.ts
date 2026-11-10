import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css',
})
export class ResetPassword {
  private readonly authService = inject(AuthService);
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
    if (this.saving()) return;

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
    this.authService.resetPassword(email, code, this.newPassword()).subscribe({
      next: () => {
        this.saving.set(false);
        this.done.set(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.errorKey.set(this.resetErrorKey(error));
      },
    });
  }

  /** Requests a fresh code when the current one expired. */
  goToNewCode(): void {
    void this.router.navigate(['/forgot-password'], {
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

  private resetErrorKey(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) return 'forgot.unknown';
      if (error.status === 0) return 'reset.network';

      if (error.status === 400) {
        const message = this.errorMessage(error);
        if (message.includes('expired')) return 'reset.expired';
        if (message.includes('too many attempts')) return 'reset.tooMany';
        if (message.includes('no reset code')) return 'reset.noCode';
        if (message.includes('incorrect reset code')) return 'reset.invalidCode';
      }
    }
    return 'reset.generic';
  }

  private errorMessage(error: HttpErrorResponse): string {
    const body = error.error as { message?: unknown } | null;
    return typeof body?.message === 'string' ? body.message.toLowerCase() : '';
  }
}

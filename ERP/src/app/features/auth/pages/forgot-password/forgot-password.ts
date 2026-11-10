import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  email = signal('');
  errorKey = signal('');
  sending = signal(false);
  resending = signal(false);
  sent = signal(false);
  sentEmail = signal('');
  expiresInMinutes = signal(0);

  constructor() {
    const prefilled = this.route.snapshot.queryParamMap.get('email');
    if (prefilled) {
      this.email.set(prefilled.trim().toLowerCase());
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.sending()) return;

    this.errorKey.set('');

    const email = this.email().trim().toLowerCase();
    if (!email) {
      this.errorKey.set('login.credentials.missing');
      return;
    }

    this.sending.set(true);
    this.authService.forgotPassword(email).subscribe({
      next: (response) => {
        this.sending.set(false);
        this.sentEmail.set(email);
        this.expiresInMinutes.set(response.expiresInMinutes);
        this.sent.set(true);
      },
      error: (error: unknown) => {
        this.sending.set(false);
        this.errorKey.set(this.forgotErrorKey(error));
      },
    });
  }

  /** Sends a fresh code to the same address from the confirmation screen. */
  resend(): void {
    if (this.resending()) return;

    this.errorKey.set('');
    this.resending.set(true);
    this.authService.forgotPassword(this.sentEmail()).subscribe({
      next: (response) => {
        this.resending.set(false);
        this.expiresInMinutes.set(response.expiresInMinutes);
      },
      error: (error: unknown) => {
        this.resending.set(false);
        this.errorKey.set(this.forgotErrorKey(error));
      },
    });
  }

  /** Goes back to the form to use another e-mail. */
  changeEmail(): void {
    this.errorKey.set('');
    this.sent.set(false);
  }

  /** Goes to the code + new password form. */
  goToReset(): void {
    void this.router.navigate(['/reset-password'], {
      queryParams: { email: this.sentEmail() },
    });
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  private forgotErrorKey(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 404) return 'forgot.unknown';
      if (error.status === 429) return 'forgot.cooldown';
      if (error.status === 502) return 'forgot.mailError';
      if (error.status === 0) return 'forgot.network';
    }
    return 'forgot.generic';
  }
}

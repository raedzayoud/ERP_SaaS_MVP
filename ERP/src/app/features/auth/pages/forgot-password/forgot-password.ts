import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { PasswordResetService } from '../../services/password-reset.service';

/**
 * Step 1 of the demo password reset: the visitor enters the e-mail of
 * their account, a 6-digit code is "sent" (MockMailService) and shown
 * on screen because demo mode has no real mailbox.
 */
@Component({
  selector: 'app-forgot-password',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword {
  private readonly resetService = inject(PasswordResetService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  email = signal('');
  errorKey = signal('');
  sending = signal(false);
  sent = signal(false);
  sentEmail = signal('');
  demoCode = signal('');

  constructor() {
    const prefilled = this.route.snapshot.queryParamMap.get('email');
    if (prefilled) {
      this.email.set(prefilled.trim().toLowerCase());
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.errorKey.set('');

    const email = this.email().trim().toLowerCase();
    if (!email) {
      this.errorKey.set('login.credentials.missing');
      return;
    }

    this.sending.set(true);
    const code = this.resetService.requestCode(email);
    this.sending.set(false);

    if (!code) {
      this.errorKey.set('forgot.unknown');
      return;
    }

    this.sentEmail.set(email);
    this.demoCode.set(code);
    this.sent.set(true);
  }

  /** Sends a fresh code to the same address from the confirmation screen. */
  resend(): void {
    const code = this.resetService.requestCode(this.sentEmail());
    if (code) {
      this.demoCode.set(code);
    }
  }

  /** Goes back to the form to use another e-mail. */
  changeEmail(): void {
    this.errorKey.set('');
    this.demoCode.set('');
    this.sent.set(false);
  }

  /** Goes to the code + new password form. */
  goToReset(): void {
    this.router.navigate(['/reset-password'], {
      queryParams: { email: this.sentEmail() },
    });
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }
}

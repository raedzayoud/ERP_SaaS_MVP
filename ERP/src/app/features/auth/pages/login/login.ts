import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  error = signal('');
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  onSubmit(): void {
    this.error.set('');
    this.loading.set(true);

    if (!this.email() || !this.password()) {
      this.error.set('Please enter email and password.');
      this.loading.set(false);
      return;
    }

    const success = this.authService.login(this.email(), this.password());
    this.loading.set(false);

    if (success) {
      this.router.navigate(['/dashboard']);
    } else {
      this.error.set('Invalid credentials. Please try again.');
    }
  }

  onEmailInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.email.set(value);
  }

  onPasswordInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.password.set(value);
  }
}

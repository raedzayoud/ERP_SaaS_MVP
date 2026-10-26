import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../../../core/services/auth.service';
import { DEMO_USERS } from '../../../../core/data/demo-users';
import { ALL_ROLES, Role, homeRouteForRole, roleLabelKey } from '../../../../core/models/role';

@Component({
  selector: 'app-login-credentials',
  imports: [RouterLink, TranslocoDirective],
  templateUrl: './login-credentials.html',
  styleUrl: './login-credentials.css',
})
export class LoginCredentials {
  role: Role | null = null;

  email = signal('');
  password = signal('');
  errorKey = signal('');
  loading = signal(false);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
  ) {
    const roleParam = this.route.snapshot.paramMap.get('role');

    if (!roleParam || !ALL_ROLES.includes(roleParam as Role)) {
      this.router.navigate(['/login']);
      return;
    }

    this.role = roleParam as Role;

    const demo = DEMO_USERS.find((user) => user.role === this.role);
    this.email.set(demo?.email ?? '');
  }

  onSubmit(event: Event): void {
    event.preventDefault();

    if (!this.role) return;

    this.errorKey.set('');

    if (!this.email().trim() || !this.password()) {
      this.errorKey.set('login.credentials.missing');
      return;
    }

    this.loading.set(true);
    const success = this.authService.loginWithCredentials(
      this.role,
      this.email(),
      this.password(),
    );
    this.loading.set(false);

    if (success) {
      this.router.navigate([homeRouteForRole(this.role)]);
    } else {
      this.errorKey.set('login.credentials.error');
    }
  }

  roleKey(role: Role): string {
    return roleLabelKey(role);
  }

  onEmailInput(event: Event): void {
    this.email.set((event.target as HTMLInputElement).value);
  }

  onPasswordInput(event: Event): void {
    this.password.set((event.target as HTMLInputElement).value);
  }
}

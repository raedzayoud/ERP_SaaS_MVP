import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {
  readonly authService = inject(AuthService);

  readonly navItems = [
    { route: '/admin', labelKey: 'admin.nav.supervision', icon: '📈', exact: true },
    { route: '/admin/tenants', labelKey: 'admin.nav.tenants', icon: '🏢', exact: false },
    { route: '/admin/signups', labelKey: 'admin.nav.signups', icon: '📝', exact: false },
    { route: '/admin/payments', labelKey: 'admin.nav.payments', icon: '🧾', exact: false },
    { route: '/admin/plans', labelKey: 'admin.nav.plans', icon: '💳', exact: false },
  ];

  logout(): void {
    this.authService.logout();
  }

  get userInitials(): string {
    const user = this.authService.currentUser();
    if (!user) return '?';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}

import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/services/auth.service';
import { LanguageService } from '../../core/services/language.service';
import { TenantService } from '../../core/services/tenant.service';
import { PermissionService } from '../../core/services/permission.service';
import { roleLabelKey } from '../../core/models/role';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, TranslocoDirective, TranslocoPipe],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  pageTitleKey = input<string>('titles.dashboard');
  toggleSidebar = output<void>();

  private readonly authServiceSvc = inject(AuthService);
  private readonly tenantService = inject(TenantService);
  private readonly languageService = inject(LanguageService);
  private readonly permissions = inject(PermissionService);

  readonly availableLangs = this.languageService.availableLangs;
  readonly currentLang = this.languageService.currentLang;

  showUserMenu = false;

  get authService() {
    return this.authServiceSvc;
  }

  get tenant() {
    return this.tenantService.currentTenant();
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  closeUserMenu(): void {
    this.showUserMenu = false;
  }

  onLangChange(event: Event): void {
    this.languageService.setLang((event.target as HTMLSelectElement).value);
  }

  logout(): void {
    this.authServiceSvc.logout();
  }

  get userInitials(): string {
    const user = this.authServiceSvc.currentUser();
    if (!user) return '?';
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  get roleLabel(): string {
    const user = this.authServiceSvc.currentUser();
    return user ? roleLabelKey(user.role) : '';
  }

  get canOpenSettings(): boolean {
    return this.permissions.canAccessModule('settings');
  }
}

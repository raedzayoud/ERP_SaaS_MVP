import { Component, input, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  pageTitle = input<string>('Dashboard');
  toggleSidebar = output<void>();

  private authServiceSvc = inject(AuthService);
  private tenantService = inject(TenantService);

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
}

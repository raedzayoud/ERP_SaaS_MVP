import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user';
import { Role, homeRouteForRole, normalizeRole, roleDisplayName } from '../models/role';
import { DEMO_USERS, DemoUser } from '../data/demo-users';
import { TenantService, RegisterTenantData } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'erp_user';
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  currentUser = signal<User | null>(this.loadUser());

  /**
   * Signs in on a role-specific login page.
   * Demo mode: the email must match the demo email of that role,
   * any non-empty password is accepted.
   */
  loginWithCredentials(role: Role, email: string, password: string): boolean {
    if (!email.trim() || !password) {
      return false;
    }

    const demo = DEMO_USERS.find((user) => user.role === role);
    if (!demo) {
      return false;
    }

    if (demo.email.toLowerCase() !== email.trim().toLowerCase()) {
      return false;
    }

    return this.loginAsDemo(demo);
  }

  /** Signs in directly from a demo account card on the login page. */
  loginAsDemo(demo: DemoUser): boolean {
    const role = demo.role;

    // Tenant roles need a workspace; create the demo one on first login.
    if (role !== 'super-admin') {
      this.tenantService.ensureDemoTenant();
    }

    const user: User = {
      id: demo.id,
      name: roleDisplayName(role),
      email: demo.email,
      role,
    };

    this.saveUser(user);
    return true;
  }

  signup(data: RegisterTenantData): boolean {
    if (!data.companyName || !data.email || !data.fullName || !data.subdomain) {
      return false;
    }
    if (!data.modules || data.modules.length === 0) {
      return false;
    }

    this.tenantService.registerTenant(data);

    const user: User = {
      id: 1,
      name: data.fullName,
      email: data.email,
      role: 'admin-entreprise',
    };

    this.saveUser(user);
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUser.set(null);
    this.tenantService.clearTenant();
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  /** Route to open after signing in, based on the role. */
  homeRouteForCurrentUser(): string {
    const user = this.currentUser();
    return user ? homeRouteForRole(user.role) : '/login';
  }

  private saveUser(user: User): void {
    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
  }

  private loadUser(): User | null {
    const data = localStorage.getItem(this.storageKey);
    if (data) {
      try {
        const parsed = JSON.parse(data) as User;
        // Migrate older stored roles ("Administrator", ...) to the new Role type.
        return { ...parsed, role: normalizeRole(parsed.role) };
      } catch {
        return null;
      }
    }
    return null;
  }
}

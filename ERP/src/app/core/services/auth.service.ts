import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { User } from '../models/user';
import { TenantService, RegisterTenantData } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'erp_user';
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  currentUser = signal<User | null>(this.loadUser());

  login(email: string, password: string): boolean {
    if (!email || !password) {
      return false;
    }

    const user: User = {
      id: 1,
      name: email.split('@')[0],
      email: email,
      role: 'Administrator',
    };

    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
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
      role: 'Administrator',
    };

    localStorage.setItem(this.storageKey, JSON.stringify(user));
    this.currentUser.set(user);
    return true;
  }

  logout(): void {
    localStorage.removeItem(this.storageKey);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  private loadUser(): User | null {
    const data = localStorage.getItem(this.storageKey);
    if (data) {
      try {
        return JSON.parse(data) as User;
      } catch {
        return null;
      }
    }
    return null;
  }
}

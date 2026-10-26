import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Role, roleModules } from '../models/role';

/**
 * Answers one simple question for the UI:
 * "is the current user allowed to see this module / this area?"
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  currentRole = computed<Role | null>(() => this.auth.currentUser()?.role ?? null);

  canAccessModule(moduleId: string): boolean {
    const role = this.currentRole();
    if (!role) return false;
    return roleModules(role).includes(moduleId);
  }

  hasAnyRole(roles: Role[]): boolean {
    const role = this.currentRole();
    return role !== null && roles.includes(role);
  }
}

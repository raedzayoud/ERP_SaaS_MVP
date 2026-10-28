import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { RbacService } from './rbac.service';
import { Role, roleModules } from '../models/role';
import { PermissionAction } from '../models/rbac';

/**
 * Answers two simple questions for the UI:
 * "may the current user run this action inside this module?"
 * "is the current user allowed to see this module / this area?"
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);
  private readonly rbac = inject(RbacService);

  currentRole = computed<Role | null>(() => this.auth.currentUser()?.role ?? null);
  currentUser = this.auth.currentUser;

  /** May the user run this action in the module? ('view' = module access.) */
  can(moduleId: string, action: PermissionAction): boolean {
    return this.rbac.can(moduleId, action);
  }

  /** Kept for the existing sidebar / navbar / apps-hub references. */
  canAccessModule(moduleId: string): boolean {
    return this.can(moduleId, 'view');
  }

  hasAnyRole(roles: Role[]): boolean {
    const role = this.currentRole();
    return role !== null && roles.includes(role);
  }
}

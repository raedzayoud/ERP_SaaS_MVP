import { inject, Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { User } from '../models/user';
import { Role } from '../models/role';
import {
  BUILTIN_PERMISSIONS,
  ModulePermissions,
  PermissionAction,
  SHARED_VIEW_MODULES,
} from '../models/rbac';

/**
 * The access-control engine.
 * Roles are fixed: each built-in role comes with its own default actions,
 * defined once in BUILTIN_PERMISSIONS.
 */
@Injectable({ providedIn: 'root' })
export class RbacService {
  private readonly auth = inject(AuthService);

  currentUser = this.auth.currentUser;

  // ── Permission resolution ────────────────────────────────────

  /** Effective permissions of a user, from its built-in role. */
  permissionsOf(user: User | null): ModulePermissions {
    if (!user) return {};

    const permissions: ModulePermissions =
      user.role === 'admin-entreprise'
        ? BUILTIN_PERMISSIONS['admin-entreprise']
        : (BUILTIN_PERMISSIONS[user.role] ?? {});

    // Workspace navigation basics: everyone inside the company can view the
    // dashboard and the application hub.
    if (user.role !== 'super-admin' && user.role !== 'client-externe') {
      for (const shared of SHARED_VIEW_MODULES) {
        permissions[shared] = [...(permissions[shared] ?? []), 'view'];
      }
    }
    return permissions;
  }

  /** True when the current user may run the given action inside the module. */
  can(moduleId: string, action: PermissionAction): boolean {
    const permissions = this.permissionsOf(this.currentUser());
    return permissions[moduleId]?.includes(action) ?? false;
  }
}

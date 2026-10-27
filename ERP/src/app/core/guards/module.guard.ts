import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { homeRouteForRole } from '../models/role';
import { PermissionService } from '../services/permission.service';
import { TenantService } from '../services/tenant.service';

export const moduleGuard: CanActivateFn = (route) => {
  const tenantService = inject(TenantService);
  const permissions = inject(PermissionService);
  const router = inject(Router);

  const moduleId = route.data?.['moduleId'];
  if (!moduleId) {
    return true;
  }
  const moduleIdString = moduleId as string;

  // Two checks: the tenant owns the module, and the user's
  // role is allowed to open it. Otherwise, back to the role home page.
  if (tenantService.enabledModules().includes(moduleIdString)) {
    if (permissions.canAccessModule(moduleIdString)) {
      return true;
    }

    const role = permissions.currentRole();
    if (role) {
      return router.createUrlTree([homeRouteForRole(role)]);
    }
  }

  return router.createUrlTree(['/module-inactive'], {
    queryParams: { module: moduleIdString },
  });
};

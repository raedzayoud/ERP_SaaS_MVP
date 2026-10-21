import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TenantService } from '../services/tenant.service';

export const moduleGuard: CanActivateFn = (route) => {
  const tenantService = inject(TenantService);
  const router = inject(Router);

  const moduleId = route.data?.['moduleId'];
  if (!moduleId) {
    return true;
  }

  const enabled = tenantService.enabledModules();
  if (enabled.includes(moduleId as string)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};

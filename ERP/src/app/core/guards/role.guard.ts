import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role, homeRouteForRole } from '../models/role';

/**
 * Blocks a route when the logged-in user's role is not in route.data.roles.
 * Example: { canActivate: [roleGuard], data: { roles: ['admin-entreprise'] } }
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (!user) {
    return router.createUrlTree(['/login']);
  }

  const roles = route.data?.['roles'] as Role[] | undefined;
  if (!roles || roles.length === 0 || roles.includes(user.role)) {
    return true;
  }

  return router.createUrlTree([homeRouteForRole(user.role)]);
};

/** Keeps already signed-in users away from /login and /signup. */
export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser();
  if (!user) {
    return true;
  }

  return router.createUrlTree([homeRouteForRole(user.role)]);
};

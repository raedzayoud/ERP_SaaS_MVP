import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { ALL_ACTIONS, ModulePermissions, PermissionAction } from '../models/rbac';
import {
  AuthMeResponse,
  AuthTokens,
  ForgotPasswordResponse,
  JwtPayload,
} from '../models/auth';
import { User } from '../models/user';
import { homeRouteForRole, normalizeRole } from '../models/role';
import { safeSessionStorage, safeStorage } from '../utils/safe-storage';
import { decodeJwtPayload } from '../utils/jwt';
import { AuthApiService } from './auth-api.service';
import { TenantService } from './tenant.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  private readonly storageKey = 'erp_refresh_token';
  private readonly legacyUserKey = 'erp_user';

  readonly currentUser = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly permissions = signal<ModulePermissions>({});

  private readonly refreshTokenState = signal<string | null>(this.loadRefreshToken());
  readonly refreshToken = this.refreshTokenState.asReadonly();

  private refreshInFlight: Observable<void> | null = null;

  /** Restores the session on application startup. */
  initialize(): Observable<void> {
    this.clearLegacyStorage();

    if (!this.refreshToken()) {
      this.clearSession();
      return of(void 0);
    }

    return this.refreshAccessToken().pipe(
      switchMap(() => this.loadMe()),
      map(() => void 0),
      catchError(() => {
        this.clearSession();
        return of(void 0);
      }),
    );
  }

  /** Signs in with the backend and loads the user and tenant. */
  login(email: string, password: string): Observable<User> {
    return this.authApi
      .login({ email: email.trim().toLowerCase(), password })
      .pipe(
        tap((tokens) => this.applyTokens(tokens)),
        switchMap(() => this.loadMe()),
        catchError((error: unknown) => {
          this.clearSession();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Rotates the refresh token and stores the new pair.
   * Concurrent callers share the same request.
   */
  refreshAccessToken(): Observable<void> {
    if (this.refreshInFlight) {
      return this.refreshInFlight;
    }

    const refreshToken = this.refreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    const request = this.authApi.refresh(refreshToken).pipe(
      tap((tokens) => this.applyTokens(tokens)),
      map(() => void 0),
      finalize(() => {
        this.refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.refreshInFlight = request;
    return request;
  }

  /** Revokes the refresh token and clears the local session. */
  logout(): void {
    const refreshToken = this.refreshToken();
    this.clearSession();

    if (refreshToken) {
      this.authApi.logout(refreshToken).subscribe({ error: () => undefined });
    }

    void this.router.navigate(['/login']);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.authApi.forgotPassword(email.trim().toLowerCase());
  }

  resetPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Observable<{ message: string }> {
    return this.authApi.resetPassword({
      email: email.trim().toLowerCase(),
      code: code.trim(),
      newPassword,
    });
  }

  /** Refreshes the user and tenant from the backend (KYC/billing changes). */
  reloadAccount(): Observable<User> {
    return this.loadMe();
  }

  /** Demo-only: the backend has no change-password endpoint yet. */
  renewPassword(newPassword: string): boolean {
    const current = this.currentUser();
    if (!current || newPassword.length < 6) return false;

    this.currentUser.set({ ...current, mustRenewPassword: false });
    if (typeof current.id === 'number') {
      this.tenantService.setUserMustRenew(current.id, false);
    }
    return true;
  }

  /** Updates the in-memory session without re-running the login flow. */
  refreshUser(user: User): void {
    this.currentUser.set({ ...user, role: normalizeRole(user.role) });
  }

  /** Clears every local authentication artefact. */
  clearSession(): void {
    this.currentUser.set(null);
    this.accessToken.set(null);
    this.permissions.set({});
    this.setRefreshToken(null);
    this.tenantService.clearTenant();
    this.clearLegacyStorage();
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  /** True when KYC and billing allow opening the business workspace. */
  hasAccountAccess(): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'super-admin') return true;

    const tenant = this.tenantService.currentTenant();
    if (!tenant) return false;
    if (tenant.tenantStatus === 'SUSPENDED') return false;

    const trialActive =
      tenant.tenantStatus === 'TRIAL' &&
      (tenant.trialLimit ?? 0) > 0 &&
      (tenant.trialUsed ?? 0) < (tenant.trialLimit ?? 0);
    if (trialActive) return true;

    const kycOk = !tenant.kycStatus || tenant.kycStatus === 'APPROVED';
    const billingOk =
      !tenant.billingStatus || ['ACTIVE', 'EXEMPT'].includes(tenant.billingStatus);
    return kycOk && billingOk;
  }

  /** Route to open after signing in, based on role and account status. */
  homeRouteForCurrentUser(): string {
    const user = this.currentUser();
    if (!user) return '/login';
    if (!this.hasAccountAccess()) return '/account-status';
    return homeRouteForRole(user.role);
  }

  private loadMe(): Observable<User> {
    return this.authApi.me().pipe(
      tap((response) => {
        if (response.accessToken) {
          this.accessToken.set(response.accessToken);
          this.applyTokenClaims(response.accessToken);
        }
        this.applyMe(response);
      }),
      map(() => {
        const user = this.currentUser();
        if (!user) {
          throw new Error('The session could not be loaded');
        }
        return user;
      }),
    );
  }

  private applyMe(response: AuthMeResponse): void {
    this.currentUser.set({
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      role: normalizeRole(response.user.role),
      mustRenewPassword: response.user.mustRenewPassword,
    });

    if (response.tenant) {
      this.tenantService.setFromAuthTenant(response.tenant);
    } else {
      this.tenantService.clearTenant();
    }

    this.persistRefreshToken(this.refreshToken());
  }

  private applyTokens(tokens: AuthTokens): void {
    this.accessToken.set(tokens.accessToken);
    this.setRefreshToken(tokens.refreshToken);
    this.applyTokenClaims(tokens.accessToken);
  }

  private applyTokenClaims(token: string): void {
    const payload = decodeJwtPayload(token);
    this.permissions.set(this.normalizePermissions(payload?.permissions));

    if (payload?.role) {
      const role = normalizeRole(payload.role);
      const current = this.currentUser();
      if (current && current.role !== role) {
        this.currentUser.set({ ...current, role });
      }
    }
  }

  private normalizePermissions(
    raw: JwtPayload['permissions'],
  ): ModulePermissions {
    const result: ModulePermissions = {};
    if (!raw) return result;

    const allowed = new Set<PermissionAction>(ALL_ACTIONS);
    for (const [moduleId, actions] of Object.entries(raw)) {
      if (!Array.isArray(actions)) continue;
      result[moduleId] = actions.filter((action): action is PermissionAction =>
        allowed.has(action as PermissionAction),
      );
    }
    return result;
  }

  private setRefreshToken(token: string | null): void {
    this.refreshTokenState.set(token);
    this.persistRefreshToken(token);
  }

  /** Trial sessions use sessionStorage so closing the browser logs out. */
  private persistRefreshToken(token: string | null): void {
    const local = safeStorage();
    const session = safeSessionStorage();
    local?.removeItem(this.storageKey);
    session?.removeItem(this.storageKey);

    if (!token) return;

    const trial = this.tenantService.currentTenant()?.tenantStatus === 'TRIAL';
    const storage = trial ? (session ?? local) : local;
    storage?.setItem(this.storageKey, token);
  }

  private loadRefreshToken(): string | null {
    return (
      safeSessionStorage()?.getItem(this.storageKey) ??
      safeStorage()?.getItem(this.storageKey) ??
      null
    );
  }

  private clearLegacyStorage(): void {
    safeStorage()?.removeItem(this.legacyUserKey);
  }
}

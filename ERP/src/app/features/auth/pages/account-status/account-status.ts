import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { Observable, catchError, of, switchMap } from 'rxjs';
import { BillingApiService } from '../../../../core/services/billing-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { BillingInterval } from '../../../../core/models/auth';

@Component({
  selector: 'app-account-status',
  imports: [TranslocoDirective],
  templateUrl: './account-status.html',
  styleUrl: './account-status.css',
})
export class AccountStatusComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly billingApi = inject(BillingApiService);
  private readonly tenantService = inject(TenantService);
  private readonly router = inject(Router);

  readonly tenant = this.tenantService.currentTenant;
  readonly loading = signal(true);
  readonly actionLoading = signal(false);
  readonly errorKey = signal('');
  readonly actionErrorKey = signal('');

  readonly tenantStatus = computed(() => this.tenant()?.tenantStatus ?? 'ACTIVE');
  readonly kycStatus = computed(() => this.tenant()?.kycStatus ?? 'PENDING');
  readonly billingStatus = computed(() => this.tenant()?.billingStatus ?? 'NONE');
  readonly trialLimit = computed(() => this.tenant()?.trialLimit ?? 0);
  readonly trialUsed = computed(() => this.tenant()?.trialUsed ?? 0);
  readonly paid = computed(() =>
    ['ACTIVE', 'EXEMPT'].includes(this.billingStatus()),
  );
  readonly trialActive = computed(
    () =>
      !this.paid() &&
      this.tenantStatus() === 'TRIAL' &&
      this.trialLimit() > 0 &&
      this.trialUsed() < this.trialLimit(),
  );
  readonly trialEnded = computed(
    () =>
      !this.paid() &&
      this.tenantStatus() === 'TRIAL' &&
      this.trialLimit() > 0 &&
      this.trialUsed() >= this.trialLimit(),
  );
  readonly trialRemaining = computed(() =>
    Math.max(0, this.trialLimit() - this.trialUsed()),
  );
  readonly suspended = computed(() => this.tenantStatus() === 'SUSPENDED');
  readonly rejected = computed(() => this.kycStatus() === 'REJECTED');
  readonly paymentRequired = computed(() =>
    ['NONE', 'CANCELED'].includes(this.billingStatus()),
  );
  readonly paymentPending = computed(() => this.billingStatus() === 'PENDING');
  readonly pastDue = computed(() => this.billingStatus() === 'PAST_DUE');
  readonly awaitingApproval = computed(
    () => this.paid() && this.kycStatus() === 'PENDING',
  );
  readonly ready = computed(() => this.auth.hasAccountAccess());

  ngOnInit(): void {
    this.reload(true);
  }

  reload(redirectWhenReady = false): void {
    this.loading.set(true);
    this.errorKey.set('');
    this.actionErrorKey.set('');

    this.auth
      .reloadAccount()
      .pipe(switchMap(() => this.syncBillingIfNeeded()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          if (redirectWhenReady && this.ready()) {
            void this.router.navigateByUrl(this.auth.homeRouteForCurrentUser());
          }
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errorKey.set(this.requestErrorKey(error));
        },
      });
  }

  retryPayment(): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(true);
    this.actionErrorKey.set('');

    const interval: BillingInterval =
      this.tenant()?.billingInterval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    this.billingApi.checkout(interval).subscribe({
      next: (response) => {
        this.actionLoading.set(false);
        if (response.url) {
          window.location.assign(response.url);
        } else {
          this.actionErrorKey.set('accountStatus.errors.action');
        }
      },
      error: (error: unknown) => {
        this.actionLoading.set(false);
        this.actionErrorKey.set(this.requestErrorKey(error));
      },
    });
  }

  openBillingPortal(): void {
    if (this.actionLoading()) return;
    this.actionLoading.set(true);
    this.actionErrorKey.set('');

    this.billingApi.portal().subscribe({
      next: (response) => {
        this.actionLoading.set(false);
        if (response.url) {
          window.location.assign(response.url);
        } else {
          this.actionErrorKey.set('accountStatus.errors.action');
        }
      },
      error: (error: unknown) => {
        this.actionLoading.set(false);
        this.actionErrorKey.set(this.requestErrorKey(error));
      },
    });
  }

  goToDashboard(): void {
    void this.router.navigateByUrl(this.auth.homeRouteForCurrentUser());
  }

  signOut(): void {
    this.auth.logout();
  }

  private syncBillingIfNeeded(): Observable<unknown> {
    const status = this.billingStatus();
    if (status !== 'PENDING' && status !== 'PAST_DUE') {
      return of(null);
    }

    return this.billingApi.refresh().pipe(
      catchError((error: unknown) => {
        this.actionErrorKey.set(this.requestErrorKey(error));
        return of(null);
      }),
      switchMap(() => this.auth.reloadAccount()),
    );
  }

  private requestErrorKey(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 0) {
      return 'accountStatus.errors.network';
    }
    return 'accountStatus.errors.action';
  }
}

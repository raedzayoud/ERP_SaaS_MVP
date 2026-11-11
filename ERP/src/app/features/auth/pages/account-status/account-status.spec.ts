import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { BillingApiService } from '../../../../core/services/billing-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import { TenantService } from '../../../../core/services/tenant.service';
import { AccountStatusComponent } from './account-status';

describe('AccountStatusComponent', () => {
  let fixture: ComponentFixture<AccountStatusComponent>;
  let tenant: ReturnType<typeof signal>;
  let auth: {
    reloadAccount: ReturnType<typeof vi.fn>;
    hasAccountAccess: ReturnType<typeof vi.fn>;
    homeRouteForCurrentUser: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };
  let billing: {
    checkout: ReturnType<typeof vi.fn>;
    portal: ReturnType<typeof vi.fn>;
    refresh: ReturnType<typeof vi.fn>;
  };
  let navigateByUrl: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tenant = signal({
      companyName: 'Acme',
      planId: 'starter',
      kycStatus: 'PENDING',
      billingStatus: 'NONE',
      billingInterval: 'MONTHLY',
    });
    auth = {
      reloadAccount: vi.fn().mockReturnValue(of(null)),
      hasAccountAccess: vi.fn().mockReturnValue(false),
      homeRouteForCurrentUser: vi.fn().mockReturnValue('/dashboard'),
      logout: vi.fn(),
    };
    billing = {
      checkout: vi.fn().mockReturnValue(of({ url: '' })),
      portal: vi.fn().mockReturnValue(of({ url: '' })),
      refresh: vi.fn().mockReturnValue(of({ status: 'ACTIVE' })),
    };

    TestBed.configureTestingModule({
      imports: [
        AccountStatusComponent,
        TranslocoTestingModule.forRoot({
          preloadLangs: true,
          langs: {
            en: {
              accountStatus: {
                retryPayment: 'Retry payment',
                subscribe: 'Subscribe',
                goToDashboard: 'Go to dashboard',
                paymentPendingText: 'Payment processing',
                paymentConfirmedText: 'Payment successful. Wait for admin approval.',
                suspendedText: 'This workspace has been suspended.',
                trialText: 'Trial mode: {{remaining}} of {{limit}} free connections left.',
                trialEndedText: 'Your 30 free connections are used.',
              },
            },
          },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: BillingApiService, useValue: billing },
        { provide: TenantService, useValue: { currentTenant: tenant } },
      ],
    });

    navigateByUrl = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockImplementation(() => Promise.resolve(true));
    fixture = TestBed.createComponent(AccountStatusComponent);
  });

  it('loads the account and shows the payment required state', () => {
    fixture.detectChanges();

    expect(auth.reloadAccount).toHaveBeenCalled();
    expect(fixture.componentInstance.loading()).toBe(false);
    expect(fixture.componentInstance.paymentRequired()).toBe(true);
    expect(fixture.componentInstance.paymentPending()).toBe(false);
    expect(fixture.componentInstance.pastDue()).toBe(false);
    expect(billing.refresh).not.toHaveBeenCalled();
  });

  it('syncs Stripe and hides the retry button while payment is pending', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      kycStatus: 'PENDING',
      billingStatus: 'PENDING',
      billingInterval: 'MONTHLY',
    });

    fixture.detectChanges();

    expect(billing.refresh).toHaveBeenCalled();
    expect(auth.reloadAccount).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.paymentRequired()).toBe(false);
    expect(fixture.componentInstance.paymentPending()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Payment processing');
    expect(fixture.nativeElement.textContent).not.toContain('Retry payment');
  });

  it('does not show the retry button for an active subscription', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      kycStatus: 'APPROVED',
      billingStatus: 'ACTIVE',
      billingInterval: 'MONTHLY',
    });
    auth.hasAccountAccess.mockReturnValue(true);

    fixture.detectChanges();

    expect(fixture.componentInstance.paymentRequired()).toBe(false);
    expect(fixture.componentInstance.paymentPending()).toBe(false);
    expect(billing.refresh).not.toHaveBeenCalled();
  });

  it('shows payment success and waits for admin approval when KYC is pending', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      tenantStatus: 'TRIAL',
      kycStatus: 'PENDING',
      billingStatus: 'ACTIVE',
      billingInterval: 'MONTHLY',
      trialLimit: 30,
      trialUsed: 8,
    });

    fixture.detectChanges();

    expect(fixture.componentInstance.trialActive()).toBe(false);
    expect(fixture.componentInstance.trialEnded()).toBe(false);
    expect(fixture.componentInstance.awaitingApproval()).toBe(true);
    expect(fixture.componentInstance.paymentRequired()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Payment successful. Wait for admin approval.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Trial mode');
    expect(fixture.nativeElement.textContent).not.toContain('Retry payment');
  });

  it('shows the suspended state without a retry payment button', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      tenantStatus: 'SUSPENDED',
      kycStatus: 'APPROVED',
      billingStatus: 'ACTIVE',
      billingInterval: 'MONTHLY',
    });

    fixture.detectChanges();

    expect(fixture.componentInstance.suspended()).toBe(true);
    expect(fixture.componentInstance.ready()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'This workspace has been suspended.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Retry payment');
  });

  it('shows the remaining trial connections and allows the workspace', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      tenantStatus: 'TRIAL',
      kycStatus: 'PENDING',
      billingStatus: 'NONE',
      billingInterval: 'MONTHLY',
      trialLimit: 30,
      trialUsed: 5,
    });
    auth.hasAccountAccess.mockReturnValue(true);

    fixture.detectChanges();

    expect(fixture.componentInstance.trialActive()).toBe(true);
    expect(fixture.componentInstance.trialEnded()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain(
      'Trial mode: 25 of 30 free connections left.',
    );
    expect(fixture.nativeElement.textContent).toContain('Go to dashboard');
  });

  it('shows the subscribe action once the trial is exhausted', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      tenantStatus: 'TRIAL',
      kycStatus: 'PENDING',
      billingStatus: 'NONE',
      billingInterval: 'MONTHLY',
      trialLimit: 30,
      trialUsed: 30,
    });

    fixture.detectChanges();

    expect(fixture.componentInstance.trialEnded()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Your 30 free connections are used.',
    );
    expect(fixture.nativeElement.textContent).toContain('Subscribe');
    expect(fixture.nativeElement.textContent).not.toContain('Retry payment');
  });

  it('reports a network failure while reloading', () => {
    auth.reloadAccount.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );

    fixture.detectChanges();

    expect(fixture.componentInstance.errorKey()).toBe('accountStatus.errors.network');
  });

  it('retries the Stripe checkout for the saved interval', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      kycStatus: 'PENDING',
      billingStatus: 'CANCELED',
      billingInterval: 'ANNUAL',
    });
    fixture.detectChanges();

    fixture.componentInstance.retryPayment();

    expect(billing.checkout).toHaveBeenCalledWith('ANNUAL');
    expect(fixture.componentInstance.actionErrorKey()).toBe('accountStatus.errors.action');
  });

  it('opens the billing portal when the subscription is past due', () => {
    tenant.set({
      companyName: 'Acme',
      planId: 'starter',
      kycStatus: 'APPROVED',
      billingStatus: 'PAST_DUE',
      billingInterval: 'MONTHLY',
    });
    fixture.detectChanges();

    fixture.componentInstance.openBillingPortal();

    expect(billing.portal).toHaveBeenCalled();
    expect(fixture.componentInstance.actionErrorKey()).toBe('accountStatus.errors.action');
  });

  it('goes back to the account home route and can sign out', () => {
    fixture.detectChanges();

    fixture.componentInstance.goToDashboard();
    fixture.componentInstance.signOut();

    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(auth.logout).toHaveBeenCalled();
  });
});

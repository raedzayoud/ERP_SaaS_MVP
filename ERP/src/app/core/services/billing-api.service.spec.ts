import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { BillingApiService } from './billing-api.service';

describe('BillingApiService', () => {
  let api: BillingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(BillingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('creates a checkout session for the chosen interval', () => {
    api.checkout('ANNUAL').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/billing/checkout-session`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ interval: 'ANNUAL' });
    request.flush({ url: 'https://checkout.stripe.com/test' });
  });

  it('loads the current subscription', () => {
    api.subscription().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/billing/subscription`);
    expect(request.request.method).toBe('GET');
    request.flush({ status: 'ACTIVE', interval: 'MONTHLY', currentPeriodEnd: '2026-12-01' });
  });

  it('refreshes the subscription from Stripe', () => {
    api.refresh().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/billing/refresh`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ status: 'ACTIVE', interval: 'MONTHLY', currentPeriodEnd: '2026-12-01' });
  });

  it('opens the billing portal', () => {
    api.portal().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/billing/portal-session`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ url: 'https://billing.stripe.com/test' });
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { MarketingApiService } from './marketing-api.service';

describe('MarketingApiService', () => {
  let api: MarketingApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(MarketingApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('loads the dashboard', () => {
    api.getDashboard().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/marketing/dashboard`);
    expect(request.request.method).toBe('GET');
    request.flush({
      activeCampaigns: 1,
      activePromotions: 2,
      marketingBudget: 500,
      currency: 'EUR',
    });
  });

  it('filters campaigns', () => {
    api.getCampaigns('spring', true).subscribe();

    const request = http.expectOne(
      `${environment.apiUrl}/marketing/campaigns?search=spring&active=true`,
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('evaluates a promotion', () => {
    const input = {
      customerId: 'customer-1',
      subtotal: 200,
      currency: 'EUR',
      date: '2026-05-01',
    };

    api.evaluatePromotion(input).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/marketing/promotions/evaluate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({});
  });

  it('deletes a segment', () => {
    api.deleteSegment('segment-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/marketing/segments/segment-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });
});

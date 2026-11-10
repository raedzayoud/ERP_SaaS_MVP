import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {
  CustomerSegment,
  CustomerSegmentInput,
  MarketingCampaign,
  MarketingCampaignInput,
  MarketingDashboard,
  MarketingPromotion,
  MarketingPromotionInput,
  PromotionEvaluationRequest,
  PromotionEvaluationResponse,
} from '../models/marketing';

@Injectable({ providedIn: 'root' })
export class MarketingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/marketing`;

  getDashboard(): Observable<MarketingDashboard> {
    return this.http.get<MarketingDashboard>(`${this.baseUrl}/dashboard`);
  }

  getCampaigns(search?: string, active?: boolean): Observable<MarketingCampaign[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (active !== undefined) params = params.set('active', active);
    return this.http.get<MarketingCampaign[]>(`${this.baseUrl}/campaigns`, { params });
  }

  getCampaign(id: string): Observable<MarketingCampaign> {
    return this.http.get<MarketingCampaign>(`${this.baseUrl}/campaigns/${id}`);
  }

  createCampaign(input: MarketingCampaignInput): Observable<MarketingCampaign> {
    return this.http.post<MarketingCampaign>(`${this.baseUrl}/campaigns`, input);
  }

  updateCampaign(id: string, input: MarketingCampaignInput): Observable<MarketingCampaign> {
    return this.http.put<MarketingCampaign>(`${this.baseUrl}/campaigns/${id}`, input);
  }

  deleteCampaign(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/campaigns/${id}`);
  }

  getPromotions(
    search?: string,
    active?: boolean,
    campaignId?: string,
    segmentId?: string,
  ): Observable<MarketingPromotion[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (active !== undefined) params = params.set('active', active);
    if (campaignId) params = params.set('campaignId', campaignId);
    if (segmentId) params = params.set('segmentId', segmentId);
    return this.http.get<MarketingPromotion[]>(`${this.baseUrl}/promotions`, { params });
  }

  getPromotion(id: string): Observable<MarketingPromotion> {
    return this.http.get<MarketingPromotion>(`${this.baseUrl}/promotions/${id}`);
  }

  createPromotion(input: MarketingPromotionInput): Observable<MarketingPromotion> {
    return this.http.post<MarketingPromotion>(`${this.baseUrl}/promotions`, input);
  }

  updatePromotion(
    id: string,
    input: MarketingPromotionInput,
  ): Observable<MarketingPromotion> {
    return this.http.put<MarketingPromotion>(`${this.baseUrl}/promotions/${id}`, input);
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/promotions/${id}`);
  }

  getEligiblePromotions(customerId: string, date?: string): Observable<MarketingPromotion[]> {
    let params = new HttpParams().set('customerId', customerId);
    if (date) params = params.set('date', date);
    return this.http.get<MarketingPromotion[]>(`${this.baseUrl}/promotions/eligible`, {
      params,
    });
  }

  evaluatePromotion(
    input: PromotionEvaluationRequest,
  ): Observable<PromotionEvaluationResponse> {
    return this.http.post<PromotionEvaluationResponse>(
      `${this.baseUrl}/promotions/evaluate`,
      input,
    );
  }

  getSegments(search?: string): Observable<CustomerSegment[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<CustomerSegment[]>(`${this.baseUrl}/segments`, { params });
  }

  getSegment(id: string): Observable<CustomerSegment> {
    return this.http.get<CustomerSegment>(`${this.baseUrl}/segments/${id}`);
  }

  createSegment(input: CustomerSegmentInput): Observable<CustomerSegment> {
    return this.http.post<CustomerSegment>(`${this.baseUrl}/segments`, input);
  }

  updateSegment(id: string, input: CustomerSegmentInput): Observable<CustomerSegment> {
    return this.http.put<CustomerSegment>(`${this.baseUrl}/segments/${id}`, input);
  }

  deleteSegment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/segments/${id}`);
  }
}

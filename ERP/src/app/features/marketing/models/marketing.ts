export type CampaignChannel = 'email' | 'social' | 'ads' | 'event' | 'other';
export type DiscountType = 'percentage' | 'fixed_amount';

export interface MarketingCampaign {
  id: string;
  name: string;
  description: string | null;
  channel: CampaignChannel;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCampaignInput {
  name: string;
  description: string;
  channel: CampaignChannel;
  startDate: string;
  endDate: string;
  budget: number;
  currency: string;
  active: boolean;
}

export interface MarketingPromotion {
  id: string;
  name: string;
  description: string | null;
  campaignId: string | null;
  campaignName: string | null;
  segmentId: string;
  segmentName: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingPromotionInput {
  name: string;
  description: string;
  campaignId: string | null;
  segmentId: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  startDate: string;
  endDate: string;
  active: boolean;
}

export interface CustomerSegment {
  id: string;
  name: string;
  description: string | null;
  customerIds: string[];
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSegmentInput {
  name: string;
  description: string;
  customerIds: string[];
}

export interface MarketingDashboard {
  activeCampaigns: number;
  activePromotions: number;
  marketingBudget: number;
  currency: string;
}

export interface PromotionEvaluationRequest {
  customerId: string;
  subtotal: number;
  currency: string;
  date?: string;
}

export interface PromotionEvaluationResponse {
  promotionId: string | null;
  promotionName: string | null;
  discountType: DiscountType | null;
  discountValue: number;
  discountAmount: number;
  finalTotal: number;
  currency: string;
}

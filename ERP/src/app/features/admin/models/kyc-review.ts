import { AuthTenantResponse } from '../../../core/models/auth';

export type KycReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SignupReviewDocument {
  id: string;
  slot: string;
  fileName: string;
  contentType: string;
  sizeKb: number;
  uploadedAt: string;
  downloadUrl: string;
}

export interface SignupReview {
  tenant: AuthTenantResponse;
  applicantName: string;
  documents: SignupReviewDocument[];
}

export interface SignupDecision {
  tenantId: string;
  status: KycReviewStatus;
  decidedAt: string;
  note: string;
  message: string;
}

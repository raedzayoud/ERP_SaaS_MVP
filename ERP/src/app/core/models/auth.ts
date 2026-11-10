export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthUserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  mustRenewPassword: boolean;
}

export interface AuthTenantResponse {
  id: string;
  companyName: string;
  email: string;
  subdomain: string;
  country: string;
  language: string;
  companySize: string;
  planId: string;
  enabledModules: string[];
  currency: string;
  taxId: string;
  address: string;
  createdAt: string | null;
  tenantStatus?: string | null;
  kycStatus?: string | null;
  billingStatus?: string | null;
  billingInterval?: string | null;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  trialLimit?: number;
  trialUsed?: number;
  trialStartedAt?: string | null;
  trialEndedAt?: string | null;
}

export interface AuthMeResponse {
  accessToken: string;
  tokenType: string;
  user: AuthUserResponse;
  tenant: AuthTenantResponse | null;
}

export interface ForgotPasswordResponse {
  message: string;
  expiresInMinutes: number;
}

export type BillingInterval = 'MONTHLY' | 'ANNUAL';

export type SignupDocumentSlot =
  | 'idCardRecto'
  | 'idCardVerso'
  | 'tradeRegister'
  | 'taxRegistration';

export interface SignupRequestPayload {
  fullName: string;
  companyName: string;
  subdomain: string;
  email: string;
  password: string;
  country: string;
  language: string;
  companySize: string;
  taxId: string;
  modules: string[];
  planId: string;
  billingInterval: BillingInterval;
  verificationToken: string;
}

export interface SignupOtpSendResponse {
  message: string;
  expiresInMinutes: number;
  resendAfterSeconds: number;
}

export interface SignupOtpVerifyResponse {
  verificationToken: string;
  expiresInMinutes: number;
}

export interface SignupResponse {
  message: string;
  checkoutUrl: string | null;
}

export interface SignupAvailabilityResponse {
  subdomainAvailable: boolean;
}

export interface AuthMessageResponse {
  message: string;
}

export interface JwtPayload {
  sub?: string;
  userId?: string;
  role?: string;
  permissions?: Record<string, string[]>;
  kycStatus?: string;
  billingStatus?: string;
  tenantId?: string;
  exp?: number;
  iat?: number;
  iss?: string;
}

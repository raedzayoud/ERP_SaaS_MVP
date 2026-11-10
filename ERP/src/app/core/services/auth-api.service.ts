import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AuthMessageResponse,
  AuthMeResponse,
  AuthTokens,
  ForgotPasswordResponse,
  LoginRequest,
  ResetPasswordRequest,
  SignupAvailabilityResponse,
  SignupDocumentSlot,
  SignupOtpSendResponse,
  SignupOtpVerifyResponse,
  SignupRequestPayload,
  SignupResponse,
} from '../models/auth';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  login(request: LoginRequest): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/login`, request);
  }

  refresh(refreshToken: string): Observable<AuthTokens> {
    return this.http.post<AuthTokens>(`${this.baseUrl}/refresh`, { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/logout`, { refreshToken });
  }

  me(): Observable<AuthMeResponse> {
    return this.http.get<AuthMeResponse>(`${this.baseUrl}/me`);
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(`${this.baseUrl}/forgot-password`, { email });
  }

  resetPassword(request: ResetPasswordRequest): Observable<AuthMessageResponse> {
    return this.http.post<AuthMessageResponse>(`${this.baseUrl}/reset-password`, request);
  }

  signupAvailability(subdomain: string): Observable<SignupAvailabilityResponse> {
    return this.http.get<SignupAvailabilityResponse>(`${this.baseUrl}/signup/availability`, {
      params: { subdomain },
    });
  }

  sendSignupOtp(email: string): Observable<SignupOtpSendResponse> {
    return this.http.post<SignupOtpSendResponse>(`${this.baseUrl}/signup/otp/send`, {
      email,
    });
  }

  verifySignupOtp(email: string, code: string): Observable<SignupOtpVerifyResponse> {
    return this.http.post<SignupOtpVerifyResponse>(`${this.baseUrl}/signup/otp/verify`, {
      email,
      code,
    });
  }

  signup(
    payload: SignupRequestPayload,
    documents: Record<SignupDocumentSlot, File>,
  ): Observable<SignupResponse> {
    const form = new FormData();
    form.append('data', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

    for (const slot of Object.keys(documents) as SignupDocumentSlot[]) {
      form.append(slot, documents[slot]);
    }

    return this.http.post<SignupResponse>(`${this.baseUrl}/signup`, form);
  }
}

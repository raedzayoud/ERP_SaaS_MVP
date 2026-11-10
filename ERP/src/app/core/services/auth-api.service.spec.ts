import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { SignupRequestPayload } from '../models/auth';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  let api: AuthApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(AuthApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('posts login credentials', () => {
    api.login({ email: 'owner@acme-test.com', password: 'secret' }).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'owner@acme-test.com',
      password: 'secret',
    });
    request.flush({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('posts the refresh token', () => {
    api.refresh('refresh-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/refresh`);
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush({
      accessToken: 'access-2',
      refreshToken: 'refresh-2',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('posts logout and accepts an empty response', () => {
    api.logout('refresh-1').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/logout`);
    expect(request.request.body).toEqual({ refreshToken: 'refresh-1' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('loads the current session', () => {
    api.me().subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.method).toBe('GET');
    request.flush({ accessToken: 'access', tokenType: 'Bearer', user: null, tenant: null });
  });

  it('requests a password reset code', () => {
    api.forgotPassword('owner@acme-test.com').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/forgot-password`);
    expect(request.request.body).toEqual({ email: 'owner@acme-test.com' });
    request.flush({ message: 'sent', expiresInMinutes: 15 });
  });

  it('submits the reset code and new password', () => {
    api
      .resetPassword({
        email: 'owner@acme-test.com',
        code: '123456',
        newPassword: 'strong-6',
      })
      .subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/reset-password`);
    expect(request.request.body).toEqual({
      email: 'owner@acme-test.com',
      code: '123456',
      newPassword: 'strong-6',
    });
    request.flush({ message: 'password updated' });
  });

  it('checks whether a signup subdomain is available', () => {
    api.signupAvailability('acme-test').subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url === `${environment.apiUrl}/auth/signup/availability` &&
        candidate.params.get('subdomain') === 'acme-test',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ subdomainAvailable: true });
  });

  it('requests a signup verification code', () => {
    api.sendSignupOtp('owner@acme-test.com').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/signup/otp/send`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'owner@acme-test.com' });
    request.flush({
      message: 'sent',
      expiresInMinutes: 15,
      resendAfterSeconds: 60,
    });
  });

  it('verifies the signup code and returns the verification token', () => {
    api.verifySignupOtp('owner@acme-test.com', '123456').subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/signup/otp/verify`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'owner@acme-test.com',
      code: '123456',
    });
    request.flush({ verificationToken: 'verified-token', expiresInMinutes: 15 });
  });

  it('posts the signup JSON and the four KYC files as multipart data', async () => {
    const payload: SignupRequestPayload = {
      fullName: 'Acme Owner',
      companyName: 'Acme',
      subdomain: 'acme-test',
      email: 'owner@acme-test.com',
      password: 'secret123',
      country: 'TN',
      language: 'en',
      companySize: '1-5',
      taxId: '1234567/A/M/000',
      modules: ['dashboard', 'contacts'],
      planId: 'starter',
      billingInterval: 'MONTHLY',
      verificationToken: 'verified-token',
    };
    const documents = {
      idCardRecto: new File(['recto'], 'recto.png', { type: 'image/png' }),
      idCardVerso: new File(['verso'], 'verso.png', { type: 'image/png' }),
      tradeRegister: new File(['register'], 'register.pdf', { type: 'application/pdf' }),
      taxRegistration: new File(['tax'], 'tax.pdf', { type: 'application/pdf' }),
    };

    api.signup(payload, documents).subscribe();

    const request = http.expectOne(`${environment.apiUrl}/auth/signup`);
    expect(request.request.method).toBe('POST');
    const body = request.request.body as FormData;
    expect(body instanceof FormData).toBe(true);
    expect(body.get('idCardRecto')).toBe(documents.idCardRecto);
    expect(body.get('idCardVerso')).toBe(documents.idCardVerso);
    expect(body.get('tradeRegister')).toBe(documents.tradeRegister);
    expect(body.get('taxRegistration')).toBe(documents.taxRegistration);

    const data = body.get('data') as Blob;
    expect(data.type).toBe('application/json');
    expect(JSON.parse(await data.text())).toEqual(payload);

    request.flush({
      message: 'Account created',
      checkoutUrl: 'https://checkout.stripe.com/test',
    });
  });
});

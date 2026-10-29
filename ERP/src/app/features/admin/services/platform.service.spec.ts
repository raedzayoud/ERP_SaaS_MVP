import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PlatformService } from './platform.service';
import { PlatformTenant, SignupRequestDocuments } from '../models/platform';
import { withFreshStorage } from '../../../core/services/storage-test-helper';

describe('PlatformService (super-admin console)', () => {
  let service: PlatformService;

  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(PlatformService);
  });

  it('seeds the platform with tenants, signups and payments', async () => {
    const stats = await firstValueFrom(service.getStats());

    expect(stats.totalTenants).toBe(4);
    expect(stats.pendingSignups).toBe(3);
    // Two overdue statements of Sahel Distribution (79 + 79)
    expect(stats.overdueAmount).toBe(158);
    // Demo SARL (199) + Atlas Consulting (79)
    expect(stats.monthlyRevenue).toBe(278);
  });

  it('approves a signup and creates the tenant entry in trial', async () => {
    const approved = await firstValueFrom(service.approveSignup(1));

    expect(approved?.status).toBe('approved');
    expect(approved?.decidedAt).toBeTruthy();

    const tenants = await firstValueFrom(service.getTenants());
    expect(tenants.length).toBe(5);
    const falcon = tenants.find((t) => t.subdomain === 'falcon')!;
    expect(falcon.status).toBe('trial');
    expect(falcon.planId).toBe('business');

    const stats = await firstValueFrom(service.getStats());
    expect(stats.pendingSignups).toBe(2);
    // A trial tenant does not count in the revenue yet
    expect(stats.monthlyRevenue).toBe(278);
  });

  it('rejects a signup with a note and creates no tenant', async () => {
    const rejected = await firstValueFrom(service.rejectSignup(2, 'Incomplete documents'));

    expect(rejected?.status).toBe('rejected');
    expect(rejected?.decisionNote).toBe('Incomplete documents');

    const tenants = await firstValueFrom(service.getTenants());
    expect(tenants.length).toBe(4);
  });

  it('ignores a decision on an already reviewed signup', async () => {
    await firstValueFrom(service.approveSignup(1));
    const replay = await firstValueFrom(service.approveSignup(1));

    expect(replay).toBeUndefined();
    const tenants = await firstValueFrom(service.getTenants());
    expect(tenants.length).toBe(5);
  });

  it('marks a payment as paid once and recalculates the overdue amount', async () => {
    const paid = await firstValueFrom(service.markPaymentPaid(7));

    expect(paid?.status).toBe('paid');
    const stats = await firstValueFrom(service.getStats());
    expect(stats.overdueAmount).toBe(79);

    const replay = await firstValueFrom(service.markPaymentPaid(7));
    expect(replay).toBeUndefined();
  });

  it('keeps the console data in localStorage for the next session', async () => {
    await firstValueFrom(service.approveSignup(3));

    // A fresh service instance replays the persisted register
    const nextSession = new PlatformService();
    const tenants = await firstValueFrom(nextSession.getTenants());

    expect(tenants.length).toBe(5);
    const silk = tenants.find((t) => t.subdomain === 'silk') as PlatformTenant;
    expect(silk.companyName).toBe('Silk Furnitures');
  });

  it('files the signup wizard request as approved with its KYC documents', async () => {
    const documents: SignupRequestDocuments = {
      idCard: { kind: 'uploaded', fileName: 'id.jpg', sizeKb: 64, dataUrl: 'data:image/jpeg;base64,x' },
      tradeRegister: { kind: 'uploaded', fileName: 'register.pdf', sizeKb: 320 },
      taxRegistration: { kind: 'submitted' },
    };

    const request = await firstValueFrom(
      service.createSignupRequest({
        companyName: 'Wizard SARL',
        subdomain: 'wizard',
        email: 'admin@wizard.tn',
        country: 'TN',
        planId: 'business',
        documents,
        decisionNote: 'Abonnement payé · justificatifs fournis',
      }),
    );

    expect(request.status).toBe('approved');
    expect(request.decidedAt).toBeTruthy();

    const signups = await firstValueFrom(service.getSignups());
    expect(signups.length).toBe(4);
    const wizard = signups.find((s) => s.subdomain === 'wizard')!;
    expect(wizard.documents.idCard.kind).toBe('uploaded');
    expect(wizard.decisionNote).toContain('Abonnement payé');

    // The wizard request never waits for a manual approval
    const stats = await firstValueFrom(service.getStats());
    expect(stats.pendingSignups).toBe(3);
  });

  it('suspends and reactivates a tenant', async () => {
    const suspended = await firstValueFrom(service.toggleStatus(1));
    expect(suspended?.status).toBe('suspended');

    const stats = await firstValueFrom(service.getStats());
    // Demo SARL leaves the paid roster (199 removed)
    expect(stats.monthlyRevenue).toBe(79);

    const back = await firstValueFrom(service.toggleStatus(1));
    expect(back?.status).toBe('active');
  });
});

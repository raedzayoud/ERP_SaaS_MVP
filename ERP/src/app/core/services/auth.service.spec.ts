import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { RbacService } from './rbac.service';
import { withFreshStorage } from './storage-test-helper';

function loginAdmin(): boolean {
  return TestBed.inject(AuthService).loginAsTenantUser('admin@demo.com', 'demo');
}

describe('AuthService workspace sessions (W3)', () => {
  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({});
  });

  it('signs in a tenant member with a custom role', () => {
    expect(loginAdmin()).toBe(true);
    TestBed.inject(TenantService).addUser({
      name: 'Nina Ops',
      email: 'nina@demo.com',
      role: 'commercial',
      mustRenewPassword: true,
    });

    const source = TestBed.inject(AuthService);
    expect(source.loginAsTenantUser('nina@demo.com', 'demo')).toBe(true);

    const user = source.currentUser();
    expect(user?.email).toBe('nina@demo.com');
    expect(user?.role).toBe('commercial');
    expect(user?.mustRenewPassword).toBe(true);
  });

  it('blocks deactivated members', () => {
    expect(loginAdmin()).toBe(true);
    const tenant = TestBed.inject(TenantService);
    tenant.addUser({ name: 'Off Line', email: 'off@demo.com', role: 'commercial' });

    const member = tenant.currentTenant()?.users.find((u) => u.email === 'off@demo.com');
    tenant.setUserActive(member!.id, false);

    expect(TestBed.inject(AuthService).loginAsTenantUser('off@demo.com', 'demo')).toBe(false);
  });

  it('completes a forced password renewal and clears the flag', () => {
    expect(loginAdmin()).toBe(true);
    const tenant = TestBed.inject(TenantService);
    tenant.addUser({
      name: 'Rami Keys',
      email: 'rami@demo.com',
      role: 'commercial',
      mustRenewPassword: true,
    });

    const auth = TestBed.inject(AuthService);
    expect(auth.loginAsTenantUser('rami@demo.com', 'demo')).toBe(true);
    expect(auth.currentUser()?.mustRenewPassword).toBe(true);

    expect(auth.renewPassword('short')).toBe(false);
    expect(auth.renewPassword('strong-6')).toBe(true);

    expect(auth.currentUser()?.mustRenewPassword).toBe(false);
    const member = tenant.currentTenant()?.users.find((u) => u.email === 'rami@demo.com');
    expect(member?.mustRenewPassword).toBe(false);
  });

  it('keeps the assigned builtin role and its permissions', () => {
    expect(loginAdmin()).toBe(true);
    const rbac = TestBed.inject(RbacService);
    const tenant = TestBed.inject(TenantService);

    tenant.addUser({
      name: 'Exact Stock',
      email: 'stocker@demo.com',
      role: 'magasinier',
    });

    const auth = TestBed.inject(AuthService);
    expect(auth.loginAsTenantUser('stocker@demo.com', 'demo')).toBe(true);
    expect(auth.currentUser()?.role).toBe('magasinier');
    expect(rbac.can('proxy', 'view')).toBe(false);
    expect(rbac.can('stock', 'update')).toBe(true);
    expect(rbac.can('accounting', 'view')).toBe(false);
  });
});

import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { RbacService } from './rbac.service';
import { PermissionAction } from '../models/rbac';
import { Role } from '../models/role';
import { withFreshStorage } from './storage-test-helper';

function loginAdmin(): boolean {
  return TestBed.inject(AuthService).loginAsTenantUser('admin@demo.com', 'demo');
}

function loginMember(email: string): boolean {
  return TestBed.inject(AuthService).loginAsTenantUser(email, 'demo');
}

function addUser(name: string, email: string, role: Role): void {
  TestBed.inject(TenantService).addUser({ name, email, role });
}

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(RbacService);
  });

  it('gives the company administrator the full cycle on every module', () => {
    expect(loginAdmin()).toBe(true);

    for (const moduleId of ['contacts', 'sales', 'accounting', 'settings']) {
      for (const action of ['view', 'create', 'delete'] as PermissionAction[]) {
        expect(service.can(moduleId, action)).toBe(true);
      }
    }
  });

  it('keeps fixed templates for the demo employees', () => {
    expect(loginAdmin()).toBe(true);
    addUser('Leila Sales', 'leila@demo.com', 'commercial');
    expect(loginMember('leila@demo.com')).toBe(true);

    expect(service.can('sales', 'create')).toBe(true);
    expect(service.can('purchases', 'create')).toBe(false);
    expect(service.can('accounting', 'view')).toBe(false);
    // Workspace basics are always viewable for members
    expect(service.can('dashboard', 'view')).toBe(true);
    expect(service.can('apps', 'view')).toBe(true);
  });

  it('keeps stock handlers inside stock and outside accounting', () => {
    expect(loginAdmin()).toBe(true);
    addUser('Karim Store', 'karim@demo.com', 'magasinier');
    expect(loginMember('karim@demo.com')).toBe(true);

    expect(service.can('stock', 'update')).toBe(true);
    expect(service.can('accounting', 'view')).toBe(false);
    expect(service.can('sales', 'create')).toBe(false);
  });

  it('lets the accountant validate invoices and pay bills', () => {
    expect(loginAdmin()).toBe(true);
    addUser('Sonia Books', 'sonia@demo.com', 'comptable');
    expect(loginMember('sonia@demo.com')).toBe(true);

    expect(service.can('invoices', 'validate')).toBe(true);
    expect(service.can('payments', 'create')).toBe(true);
    expect(service.can('contacts', 'create')).toBe(false);
    expect(service.can('stock', 'view')).toBe(false);
  });

  it('lets the director review without editing or deleting', () => {
    expect(loginAdmin()).toBe(true);
    addUser('Hedi Review', 'hedi@demo.com', 'directeur');
    expect(loginMember('hedi@demo.com')).toBe(true);

    expect(service.can('invoices', 'view')).toBe(true);
    expect(service.can('invoices', 'validate')).toBe(true);
    expect(service.can('invoices', 'create')).toBe(false);
    expect(service.can('invoices', 'delete')).toBe(false);
    expect(service.can('settings', 'view')).toBe(false);
  });

  it('reports no access for the external client inside the workspace', () => {
    TestBed.inject(AuthService).refreshUser({
      id: 99,
      name: 'Client',
      email: 'client@demo.com',
      role: 'client-externe',
    });

    expect(service.can('invoices', 'view')).toBe(false);
    expect(service.can('dashboard', 'view')).toBe(false);
  });
});

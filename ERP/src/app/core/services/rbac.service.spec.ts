import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ModulePermissions, PermissionAction } from '../models/rbac';
import { Role } from '../models/role';
import { User } from '../models/user';
import { AuthService } from './auth.service';
import { RbacService } from './rbac.service';

describe('RbacService', () => {
  let service: RbacService;
  let currentUser: WritableSignal<User | null>;
  let accessToken: WritableSignal<string | null>;
  let permissions: WritableSignal<ModulePermissions>;

  beforeEach(() => {
    currentUser = signal<User | null>(null);
    accessToken = signal<string | null>(null);
    permissions = signal<ModulePermissions>({});

    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser, accessToken, permissions },
        },
      ],
    });

    service = TestBed.inject(RbacService);
  });

  function signIn(role: Role): void {
    currentUser.set({
      id: 1,
      name: 'Test User',
      email: 'user@acme-test.com',
      role,
    });
  }

  it('gives the company administrator the full cycle on every module', () => {
    signIn('admin-entreprise');

    for (const moduleId of ['contacts', 'sales', 'accounting', 'settings']) {
      for (const action of ['view', 'create', 'delete'] as PermissionAction[]) {
        expect(service.can(moduleId, action)).toBe(true);
      }
    }
  });

  it('falls back to the builtin role matrix before a JWT is loaded', () => {
    signIn('commercial');

    expect(service.can('sales', 'create')).toBe(true);
    expect(service.can('purchases', 'create')).toBe(false);
    expect(service.can('accounting', 'view')).toBe(false);
    expect(service.can('dashboard', 'view')).toBe(true);
    expect(service.can('apps', 'view')).toBe(true);
  });

  it('uses the permissions carried by the access token when present', () => {
    signIn('admin-entreprise');
    accessToken.set('access-token');
    permissions.set({
      contacts: ['view'],
      dashboard: ['view'],
    });

    expect(service.can('contacts', 'view')).toBe(true);
    expect(service.can('contacts', 'create')).toBe(false);
    expect(service.can('sales', 'view')).toBe(false);
  });

  it('keeps super-admin and external-client tokens permission-free', () => {
    signIn('super-admin');
    accessToken.set('access-token');
    permissions.set({});

    expect(service.can('dashboard', 'view')).toBe(false);
    expect(service.can('settings', 'view')).toBe(false);
  });

  it('does not expose workspace modules to external clients', () => {
    signIn('client-externe');

    expect(service.can('invoices', 'view')).toBe(false);
    expect(service.can('dashboard', 'view')).toBe(false);
  });
});

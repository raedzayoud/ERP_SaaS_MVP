import { TestBed } from '@angular/core/testing';
import { AuditEntry } from './audit.service';
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { withFreshStorage } from './storage-test-helper';

describe('AuditService', () => {
  let service: AuditService;
  let auth: AuthService;

  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuditService);
    auth = TestBed.inject(AuthService);
  });

  it('starts with the four seeded entries', () => {
    const entries = service.recent(10);

    expect(entries.length).toBe(4);
    expect(entries[0].at.localeCompare(entries[1].at)).toBeGreaterThanOrEqual(0);
  });

  it('logs a new entry for the signed-in user', () => {
    auth.refreshUser({ id: 2, name: 'Amira', email: 'admin@demo.com', role: 'admin-entreprise' });

    service.log('sales', 'create', 'Invoice issued');

    const first = service.recent(1)[0] as AuditEntry;
    expect(first.userName).toBe('Amira');
    expect(first.module).toBe('sales');
    expect(first.action).toBe('create');
    expect(first.detail).toBe('Invoice issued');
    expect(service.recent(10).length).toBe(5);
  });

  it('honors the requested limit', () => {
    expect(service.recent(2).length).toBe(2);
    expect(service.recent(1).length).toBe(1);
  });

  it('resets back to the seed entries', () => {
    auth.refreshUser({ id: 2, name: 'Amira', email: 'admin@demo.com', role: 'admin-entreprise' });
    service.log('payments', 'payment', 'Payment registered');

    service.reset();

    expect(service.recent(10).length).toBe(4);
  });
});

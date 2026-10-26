import { TestBed } from '@angular/core/testing';
import { MockMailService } from './mock-mail.service';

describe('MockMailService', () => {
  let service: MockMailService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MockMailService);
  });

  it('starts with an empty outbox', () => {
    expect(service.outbox().length).toBe(0);
    expect(service.last()).toBeNull();
  });

  it('stores a sent message with its send date', () => {
    const sent = service.send({
      to: 'client@demo.com',
      subject: 'Order confirmed',
      body: 'Thank you.',
    });

    expect(service.outbox().length).toBe(1);
    expect(sent.to).toBe('client@demo.com');
    expect(sent.sentAt).not.toBe('');
  });

  it('returns the most recent message from last()', () => {
    service.send({ to: 'a@test.com', subject: 'First', body: '' });
    service.send({ to: 'b@test.com', subject: 'Second', body: '' });

    expect(service.last()?.subject).toBe('Second');
  });
});

import { Injectable, signal } from '@angular/core';

export interface MockMail {
  to: string;
  subject: string;
  body: string;
  sentAt: string;
}

/**
 * Demo-only e-mail box: keeps the confirmation messages sent by the portal
 * in memory so the UI can show them. No real e-mail ever leaves the browser.
 */
@Injectable({ providedIn: 'root' })
export class MockMailService {
  private readonly messages = signal<MockMail[]>([]);

  readonly outbox = this.messages.asReadonly();

  send(mail: Omit<MockMail, 'sentAt'>): MockMail {
    const sent: MockMail = { ...mail, sentAt: new Date().toISOString() };
    this.messages.update((list) => [...list, sent]);
    return sent;
  }

  last(): MockMail | null {
    const list = this.messages();
    return list.length ? list[list.length - 1] : null;
  }
}

import { TestBed } from '@angular/core/testing';

import { withFreshStorage } from '../../../core/services/storage-test-helper';
import { AssistantService } from './assistant';

/** Waits for the mock reply delay (400 ms) to elapse. */
function waitForReply(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 450));
}

describe('AssistantService', () => {
  let service: AssistantService;

  beforeEach(() => {
    withFreshStorage();
    TestBed.configureTestingModule({});
    service = TestBed.inject(AssistantService);
  });

  it('answers unpaid invoice questions with counts', async () => {
    service.ask('How many unpaid invoices do I have?');
    await waitForReply();

    const reply = service.messages().find((m) => m.role === 'assistant');
    expect(reply?.answerKey).toBe('assistant.answers.unpaid');
    expect(reply?.params?.['count']).toBe('3');
    expect(service.quotaUsed()).toBe(1);
  });

  it('extracts an invoice when an FA number is present', async () => {
    service.ask('Please extract invoice FA-2026-031 for me');
    await waitForReply();

    const reply = service.messages().find((m) => m.role === 'assistant');
    expect(reply?.answerKey).toBe('assistant.answers.extracted');
    expect(reply?.params?.['number']).toBe('FA-2026-031');
  });

  it('falls back to a generic answer for unknown questions', async () => {
    service.ask('zzz unknown question');
    await waitForReply();

    const reply = service.messages().find((m) => m.role === 'assistant');
    expect(reply?.answerKey).toBe('assistant.answers.fallback');
  });

  it('ignores empty input and does not spend quota', () => {
    service.ask('   ');
    expect(service.messages()).toHaveLength(0);
    expect(service.quotaUsed()).toBe(0);
  });

  it('refuses to answer once the monthly quota is exhausted', async () => {
    service.quotaUsed.set(service.quotaLimit);
    service.ask('How many unpaid invoices?');
    await waitForReply();

    const reply = service.messages().find((m) => m.role === 'assistant');
    expect(reply?.answerKey).toBe('assistant.answers.quotaExceeded');
    expect(service.quotaUsed()).toBe(service.quotaLimit);
  });
});

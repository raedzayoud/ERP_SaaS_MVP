import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { withFreshStorage } from '../../../../core/services/storage-test-helper';
import { AssistantPage } from './assistant';

/** Keys the assistant template renders (same trick as room.spec). */
const EN = {
  titles: { 'ai-assistant': 'AI assistant' },
  descriptions: { 'ai-assistant': 'Chat assistant and document extraction.' },
  assistant: {
    welcome: 'Ask me anything about your ERP data.',
    placeholder: 'Ask the assistant…',
    send: 'Send',
    typing: 'The assistant is writing…',
    quota: '{{used}} / {{limit}} queries this month',
    quotaBanner: 'Monthly AI quota reached.',
    you: 'You',
    name: 'Assistant',
    suggestions: {
      unpaid: 'How many unpaid invoices?',
      stock: 'What is the stock situation?',
      revenue: 'What is the revenue this month?',
      extract: 'Extract invoice FA-2026-031',
    },
    answers: {
      unpaid: 'You have {{count}} unpaid invoices.',
      stock: 'Stock is healthy.',
      revenue: 'Revenue is up.',
      clients: 'You have 42 active clients.',
      payments: 'Three payments received.',
      extracted: 'Invoice {{number}}.',
      fallback: 'I could not find an answer.',
      quotaExceeded: 'Monthly quota used up.',
    },
  },
};

/** Waits for the mock reply delay (400 ms) to elapse. */
function waitForReply(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 450));
}

async function setupAssistantPage(): Promise<{
  fixture: ComponentFixture<AssistantPage>;
  component: AssistantPage;
}> {
  await TestBed.configureTestingModule({
    imports: [
      AssistantPage,
      TranslocoTestingModule.forRoot({
        preloadLangs: true,
        langs: { en: EN },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AssistantPage);
  const component = fixture.componentInstance;
  fixture.detectChanges();
  return { fixture, component };
}

describe('AssistantPage', () => {
  beforeEach(() => {
    withFreshStorage();
  });

  it('shows the welcome message with clickable suggestions while empty', async () => {
    const { fixture } = await setupAssistantPage();
    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Ask me anything about your ERP data.');
    expect(element.querySelectorAll('.suggestion-chip')).toHaveLength(4);
    expect(element.querySelector('#assistant-input')).toBeTruthy();
  });

  it('sends a question from a suggestion and shows the assistant reply', async () => {
    const { fixture, component } = await setupAssistantPage();
    const element: HTMLElement = fixture.nativeElement;

    component.useSuggestion('assistant.suggestions.unpaid');
    fixture.detectChanges();

    expect(component.messages()).toHaveLength(1);
    expect(element.textContent).toContain('How many unpaid invoices?');

    await waitForReply();
    fixture.detectChanges();

    expect(component.messages()).toHaveLength(2);
    expect(element.textContent).toContain('You have 3 unpaid invoices.');
  });
});

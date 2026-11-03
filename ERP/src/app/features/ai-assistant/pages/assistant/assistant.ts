import { DatePipe } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { ChatMessage } from '../../models/chat';
import { AssistantService } from '../../services/assistant';

@Component({
  selector: 'app-assistant',
  imports: [DatePipe, TranslocoDirective],
  templateUrl: './assistant.html',
  styleUrl: './assistant.css',
})
export class AssistantPage {
  private readonly service = inject(AssistantService);
  private readonly transloco = inject(TranslocoService);

  readonly messages = this.service.messages;
  readonly pending = this.service.pending;
  readonly quotaUsed = this.service.quotaUsed;
  readonly quotaLimit = this.service.quotaLimit;
  readonly quotaReached = this.service.quotaReached;

  readonly draft = signal('');

  /** i18n keys of the clickable suggestions shown while the chat is empty. */
  readonly suggestions = [
    'assistant.suggestions.unpaid',
    'assistant.suggestions.stock',
    'assistant.suggestions.revenue',
    'assistant.suggestions.extract',
  ];

  readonly canSend = computed(
    () => !!this.draft().trim() && !this.pending() && !this.quotaReached(),
  );

  /** Keeps the newest message in view as the conversation grows. */
  private readonly feed = viewChild<ElementRef<HTMLElement>>('feed');
  private readonly scrollEffect = effect(() => {
    this.messages();
    const element = this.feed()?.nativeElement;
    if (!element) return;
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  });

  onDraftInput(value: string): void {
    this.draft.set(value);
  }

  send(): void {
    const text = this.draft().trim();
    if (!text || this.pending() || this.quotaReached()) return;
    this.draft.set('');
    this.service.ask(text);
  }

  /** Sends the translated suggestion text, so the user sees what is asked. */
  useSuggestion(suggestionKey: string): void {
    if (this.pending() || this.quotaReached()) return;
    this.service.ask(this.transloco.translate(suggestionKey));
  }

  trackMessage(index: number, message: ChatMessage): string {
    return message.id;
  }
}

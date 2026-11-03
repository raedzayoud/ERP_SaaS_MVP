import { Injectable, computed, signal } from '@angular/core';

import { ChatMessage } from '../models/chat';
import { safeStorage } from '../../../core/utils/safe-storage';

const QUOTA_LIMIT = 1000;
const QUOTA_KEY = 'ai_quota_used';
const REPLY_DELAY_MS = 400;

/** Keyword rules: first match wins. Keys are i18n answer keys (never raw text). */
const ANSWER_RULES: { keys: RegExp; answerKey: string }[] = [
  { keys: /facture|invoice|impay|unpaid|due|échéance|echéance/i, answerKey: 'assistant.answers.unpaid' },
  { keys: /stock|inventor|warehouse|entrepot|entrepôt|quantit/i, answerKey: 'assistant.answers.stock' },
  { keys: /revenu|revenue|chiffre|turnover|vente|mois/i, answerKey: 'assistant.answers.revenue' },
  { keys: /client|customer|prospect|crm|fournisseur|supplier/i, answerKey: 'assistant.answers.clients' },
  { keys: /paiement|payment|cash|trésor|tresor/i, answerKey: 'assistant.answers.payments' },
];

@Injectable({
  providedIn: 'root',
})
export class AssistantService {
  readonly messages = signal<ChatMessage[]>([]);
  readonly pending = signal(false);
  readonly quotaUsed = signal(0);
  readonly quotaLimit = QUOTA_LIMIT;
  readonly quotaLeft = computed(() => Math.max(0, this.quotaLimit - this.quotaUsed()));
  readonly quotaReached = computed(() => this.quotaLeft() <= 0);

  constructor() {
    const stored = Number(safeStorage()?.getItem(QUOTA_KEY) ?? 0);
    if (Number.isFinite(stored) && stored > 0) {
      this.quotaUsed.set(stored);
    }
  }

  /** Answers a user question with a deterministic mock reply. */
  ask(question: string): void {
    const text = question.trim();
    if (!text || this.pending()) return;

    this.messages.update((list) => [...list, this.userMessage(text)]);

    if (this.quotaReached()) {
      this.messages.update((list) => [...list, this.reply('assistant.answers.quotaExceeded')]);
      return;
    }

    this.quotaUsed.update((count) => {
      const next = count + 1;
      safeStorage()?.setItem(QUOTA_KEY, String(next));
      return next;
    });

    this.pending.set(true);
    const answer = this.answerFor(text);
    setTimeout(() => {
      this.messages.update((list) => [...list, this.reply(answer.answerKey, answer.params)]);
      this.pending.set(false);
    }, REPLY_DELAY_MS);
  }

  private answerFor(question: string): { answerKey: string; params?: Record<string, string> } {
    const invoiceNumber = question.match(/FA-\d{4}-\d+/i)?.[0];
    if (invoiceNumber) {
      return {
        answerKey: 'assistant.answers.extracted',
        params: { number: invoiceNumber.toUpperCase(), amount: '4 250,00', due: '2026-03-31' },
      };
    }

    const rule = ANSWER_RULES.find((entry) => entry.keys.test(question));
    if (rule?.answerKey === 'assistant.answers.unpaid') {
      return { answerKey: rule.answerKey, params: { count: '3', total: '12 480,00' } };
    }
    if (rule) return { answerKey: rule.answerKey };
    return { answerKey: 'assistant.answers.fallback' };
  }

  private userMessage(text: string): ChatMessage {
    return {
      id: this.nextId('u'),
      role: 'user',
      answerKey: 'assistant.raw',
      params: { text },
      createdAt: Date.now(),
    };
  }

  private reply(answerKey: string, params?: Record<string, string>): ChatMessage {
    return {
      id: this.nextId('a'),
      role: 'assistant',
      answerKey,
      params,
      createdAt: Date.now(),
    };
  }

  private nextId(prefix: string): string {
    return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  }
}

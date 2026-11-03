/** A single line in the assistant conversation. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  /** i18n key of the answer (never raw text, so both languages stay translatable). */
  answerKey: string;
  /** Values interpolated into the answer, e.g. { count: '3' }. */
  params?: Record<string, string>;
  createdAt: number;
}

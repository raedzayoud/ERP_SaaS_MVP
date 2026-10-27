export type InteractionType = 'call' | 'email' | 'meeting' | 'note';

export const INTERACTION_TYPES: InteractionType[] = ['call', 'email', 'meeting', 'note'];

export interface CrmInteraction {
  id: string;
  partnerId: string;
  type: InteractionType;
  date: string;
  subject: string;
  notes: string;
  reminderAt: string | null;
  reminderDone: boolean;
  createdAt: string;
}

export interface CrmInteractionInput {
  id: string | null;
  partnerId: string;
  type: InteractionType;
  date: string;
  subject: string;
  notes: string;
  reminderAt: string | null;
}

export type InteractionChannel = 'note' | 'email' | 'phone' | 'meeting';

export interface TicketInteraction {
  id: string;
  ticketId: string;
  author: string;
  channel: InteractionChannel;
  message: string;
  createdAt: string;
}

export interface InteractionInput {
  author: string;
  channel: InteractionChannel;
  message: string;
}

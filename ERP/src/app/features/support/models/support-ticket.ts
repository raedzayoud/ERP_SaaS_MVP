export type TicketType = 'ticket' | 'complaint' | 'request';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketInput {
  subject: string;
  description: string;
  requesterName: string;
  requesterEmail: string;
  type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
}

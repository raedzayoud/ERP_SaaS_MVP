export type LeadSource = 'website' | 'referral' | 'event' | 'campaign' | 'cold_call';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';

export const LEAD_SOURCES: LeadSource[] = [
  'website',
  'referral',
  'event',
  'campaign',
  'cold_call',
];

export const LEAD_OPEN_STATUSES: LeadStatus[] = ['new', 'contacted', 'qualified'];

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  convertedPartnerId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeadInput {
  id: string | null;
  name: string;
  company: string;
  email: string;
  phone: string;
  source: LeadSource;
  status: LeadStatus;
  notes: string;
}

export interface LeadQuery {
  page: number;
  size: number;
  search?: string;
  status?: LeadStatus;
  sort?: string;
}

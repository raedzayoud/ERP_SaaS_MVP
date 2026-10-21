export type PartnerKind = 'company' | 'person';

export interface PartnerAddress {
  street: string;
  city: string;
  country: string;
}

export interface Partner {
  id: string;
  kind: PartnerKind;
  name: string;
  parentId: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  taxId: string;
  email: string;
  phone: string;
  jobTitle: string;
  address: PartnerAddress;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type PartnerInput = Omit<Partner, 'id' | 'createdAt' | 'updatedAt' | 'active'>;

export interface PartnerQuery {
  page: number;
  size: number;
  search?: string;
  kind?: PartnerKind;
  active?: boolean;
  sort?: string;
}

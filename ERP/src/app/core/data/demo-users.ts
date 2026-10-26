import { Role } from '../models/role';

export interface DemoUser {
  id: number;
  email: string;
  role: Role;
}

/**
 * One demo account per profile. The login page shows this list;
 * each card signs the user in with that role and opens its own space.
 */
export const DEMO_USERS: DemoUser[] = [
  { id: 1, email: 'superadmin@platform.com', role: 'super-admin' },
  { id: 2, email: 'admin@demo.com', role: 'admin-entreprise' },
  { id: 3, email: 'commercial@demo.com', role: 'commercial' },
  { id: 4, email: 'acheteur@demo.com', role: 'acheteur' },
  { id: 5, email: 'magasinier@demo.com', role: 'magasinier' },
  { id: 6, email: 'comptable@demo.com', role: 'comptable' },
  { id: 7, email: 'directeur@demo.com', role: 'directeur' },
  { id: 8, email: 'client@demo.com', role: 'client-externe' },
];

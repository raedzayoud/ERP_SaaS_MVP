import { homeRouteForRole } from './role';

describe('homeRouteForRole', () => {
  it('sends the platform super-admin to the console', () => {
    expect(homeRouteForRole('super-admin')).toBe('/admin');
  });

  it('sends admin-entreprise and directeur to the global dashboard', () => {
    expect(homeRouteForRole('admin-entreprise')).toBe('/dashboard');
    expect(homeRouteForRole('directeur')).toBe('/dashboard');
  });

  it('gives each operating role its dedicated role dashboard', () => {
    expect(homeRouteForRole('commercial')).toBe('/dashboard/sales');
    expect(homeRouteForRole('acheteur')).toBe('/dashboard/purchase');
    expect(homeRouteForRole('magasinier')).toBe('/dashboard/warehouse');
    expect(homeRouteForRole('comptable')).toBe('/dashboard/accounting');
  });

  it('sends the external client to its portal', () => {
    expect(homeRouteForRole('client-externe')).toBe('/portal/invoices');
  });
});

/**
 * Returns the browser storage only when it really behaves like a Storage.
 * Test runners may expose a partial `localStorage`; guards keep the app
 * working without persistence in that case.
 */
export function safeStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return typeof localStorage.getItem === 'function' ? localStorage : null;
}

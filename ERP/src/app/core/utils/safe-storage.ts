/**
 * Returns the browser storage only when it really behaves like a Storage.
 * Test runners may expose a partial `localStorage`; guards keep the app
 * working without persistence in that case.
 */
export function safeStorage(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return typeof localStorage.getItem === 'function' ? localStorage : null;
}

/** Session storage clears when the browser tab closes. */
export function safeSessionStorage(): Storage | null {
  if (typeof sessionStorage === 'undefined') return null;
  return typeof sessionStorage.getItem === 'function' ? sessionStorage : null;
}

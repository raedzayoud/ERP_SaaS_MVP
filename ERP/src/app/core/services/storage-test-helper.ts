/**
 * Test-only helper. The Vitest environment of this project exposes a
 * `localStorage` object without Storage methods, so specs install a tiny
 * in-memory implementation (same idea as the guard in language.service).
 */
export function withFreshStorage(): void {
  installFreshStorage('localStorage');
  installFreshStorage('sessionStorage');
}

function installFreshStorage(name: 'localStorage' | 'sessionStorage'): void {
  const existing = globalThis[name] as unknown as Partial<Storage> | undefined;

  if (existing && typeof existing.setItem === 'function' && typeof existing.clear === 'function') {
    existing.clear();
    return;
  }

  const store = new Map<string, string>();
  Object.defineProperty(globalThis, name, {
    value: {
      getItem: (key: string): string | null => store.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        store.set(key, String(value));
      },
      removeItem: (key: string): void => {
        store.delete(key);
      },
      clear: (): void => {
        store.clear();
      },
    } as Storage,
    configurable: true,
  });
}

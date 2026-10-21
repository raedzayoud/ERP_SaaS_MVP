import { inject, Injectable } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const STORAGE_KEY = 'erp_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly storageKey = STORAGE_KEY;
  private readonly transloco = inject(TranslocoService);

  readonly availableLangs = [
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
  ];

  readonly currentLang = this.transloco.activeLang;

  constructor() {
    const saved = this.readLang();

    if (saved && this.isSupported(saved)) {
      this.transloco.setActiveLang(saved);
    }
  }

  setLang(lang: string): void {
    if (!this.isSupported(lang)) return;

    this.transloco.setActiveLang(lang);
    this.writeLang(lang);
  }

  private isSupported(lang: string): boolean {
    return this.availableLangs.some((item) => item.code === lang);
  }

  private readLang(): string | null {
    const store = this.storage();
    return store ? store.getItem(this.storageKey) : null;
  }

  private writeLang(lang: string): void {
    this.storage()?.setItem(this.storageKey, lang);
  }

  private storage(): Storage | null {
    if (typeof localStorage === 'undefined') return null;
    return typeof localStorage.getItem === 'function' ? localStorage : null;
  }
}

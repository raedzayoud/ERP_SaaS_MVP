import { Injectable, signal } from '@angular/core';
import {
  DEFAULT_INVOICING_SETTINGS,
  InvoicingSettings,
  isValidPrefix,
} from '../models/invoicing-settings';

const STORAGE_KEY = 'erp_invoicing';

@Injectable({ providedIn: 'root' })
export class InvoicingSettingsService {
  readonly settings = signal<InvoicingSettings>(this.load());

  update(patch: Partial<InvoicingSettings>): void {
    const merged: InvoicingSettings = { ...this.settings(), ...patch };

    if (!isValidPrefix(merged.invoicePrefix)) return;
    if (!isValidPrefix(merged.creditNotePrefix)) return;
    if (!isValidPrefix(merged.quotePrefix)) return;

    this.settings.set(merged);
    this.save(merged);
  }

  prefixFor(kind: 'invoice' | 'credit_note' | 'quote'): string {
    const current = this.settings();
    if (kind === 'invoice') return current.invoicePrefix;
    if (kind === 'credit_note') return current.creditNotePrefix;
    return current.quotePrefix;
  }

  private load(): InvoicingSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_INVOICING_SETTINGS };

      const stored = JSON.parse(raw) as Partial<InvoicingSettings>;
      return { ...DEFAULT_INVOICING_SETTINGS, ...stored };
    } catch {
      return { ...DEFAULT_INVOICING_SETTINGS };
    }
  }

  private save(settings: InvoicingSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // localStorage indisponible : les réglages restent en mémoire pour la session
    }
  }
}

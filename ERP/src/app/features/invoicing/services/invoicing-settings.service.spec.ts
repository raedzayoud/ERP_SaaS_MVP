import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { InvoicingSettingsService } from './invoicing-settings.service';
import { InvoiceService } from '../../invoices/services/invoice.service';

const STORAGE_KEY = 'erp_invoicing';
const FAC_DRAFT = 'c3000000-0000-4000-8000-000000000001';

function installMockStorage(): void {
  const memory = new Map<string, string>();
  const mock = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => {
      memory.set(key, value);
    },
    removeItem: (key: string) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: (index: number) => [...memory.keys()][index] ?? null,
    get length() {
      return memory.size;
    },
  };

  try {
    Object.defineProperty(globalThis, 'localStorage', { value: mock, configurable: true });
  } catch {
    // environnement de test sans remplacement possible
  }
}

describe('InvoicingSettingsService', () => {
  let service: InvoicingSettingsService;

  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
    service = TestBed.inject(InvoicingSettingsService);
  });

  it('starts with the default settings and persists updates', () => {
    expect(service.settings().invoicePrefix).toBe('FAC');

    service.update({ invoicePrefix: 'FACT', defaultVatRate: 7 });

    expect(service.settings().invoicePrefix).toBe('FACT');
    expect(service.settings().defaultVatRate).toBe(7);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    expect(stored.invoicePrefix).toBe('FACT');
    expect(stored.defaultVatRate).toBe(7);
  });

  it('rejects a prefix containing a dash', () => {
    service.update({ invoicePrefix: 'FA-C' });

    expect(service.settings().invoicePrefix).toBe('FAC');
  });

  it('maps each document kind to its prefix', () => {
    service.update({ invoicePrefix: 'FACT', creditNotePrefix: 'AVO', quotePrefix: 'DEVIS' });

    expect(service.prefixFor('invoice')).toBe('FACT');
    expect(service.prefixFor('credit_note')).toBe('AVO');
    expect(service.prefixFor('quote')).toBe('DEVIS');
  });

  it('reloads persisted settings on a fresh injection', () => {
    service.update({ quotePrefix: 'PRO' });

    const fresh = new InvoicingSettingsService();
    expect(fresh.settings().quotePrefix).toBe('PRO');
  });
});

describe('Invoicing numbering integration', () => {
  beforeEach(() => {
    installMockStorage();
    localStorage.removeItem(STORAGE_KEY);
    TestBed.configureTestingModule({});
  });

  it('uses the configured prefix for the next posted invoice number', async () => {
    const settings = TestBed.inject(InvoicingSettingsService);
    settings.update({ invoicePrefix: 'FACT' });

    const invoices = TestBed.inject(InvoiceService);
    const posted = await firstValueFrom(invoices.postInvoice(FAC_DRAFT));

    expect(posted.number).toBe('FACT-2026-0001');
  });
});

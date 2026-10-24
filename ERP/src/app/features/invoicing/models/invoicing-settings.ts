export interface InvoicingSettings {
  invoicePrefix: string;
  creditNotePrefix: string;
  quotePrefix: string;
  defaultVatRate: number;
  defaultStampDuty: number;
  activeVatRates: number[];
}

export const DEFAULT_INVOICING_SETTINGS: InvoicingSettings = {
  invoicePrefix: 'FAC',
  creditNotePrefix: 'AV',
  quotePrefix: 'DEV',
  defaultVatRate: 19,
  defaultStampDuty: 0,
  activeVatRates: [0, 5.5, 7, 10, 13, 19, 20],
};

export const PREFIX_PATTERN = /^[A-Za-z0-9]+$/;

export function isValidPrefix(prefix: string): boolean {
  return PREFIX_PATTERN.test(prefix);
}

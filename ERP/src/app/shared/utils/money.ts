export interface LineTotals {
  gross: number;
  discount: number;
  net: number;
}

export interface VatGroup {
  rate: number;
  base: number;
  vat: number;
}

export interface DocumentTotals {
  lines: LineTotals[];
  totalNet: number;
  vatByRate: VatGroup[];
  totalVat: number;
  totalTtc: number;
}

export interface LineLike {
  quantity: number;
  unitPrice: number;
  discountPct: number;
  vatRate: number;
}

const CURRENCY_DECIMALS: Record<string, number> = { TND: 3, JPY: 0, KWD: 3, BHD: 3, OMR: 3 };
const DEFAULT_DECIMALS = 2;
const NARROW_SPACES = /[\u202F\u00A0\u2009\u200A]/g;
const LOCALES: Record<string, string> = { fr: 'fr-FR', en: 'en-US' };

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? DEFAULT_DECIMALS;
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function lineTotals(line: LineLike, currency: string): LineTotals {
  const gross = roundMoney(line.quantity * line.unitPrice, currency);
  const discount = roundMoney(gross * (line.discountPct / 100), currency);
  return { gross, discount, net: roundMoney(gross - discount, currency) };
}

export function totalsFor(lines: LineLike[], currency: string): DocumentTotals {
  const lineTotalsList = lines.map((line) => lineTotals(line, currency));
  const totalNet = roundMoney(
    lineTotalsList.reduce((sum, line) => sum + line.net, 0),
    currency,
  );

  const bases = new Map<number, number>();
  lines.forEach((line, index) => {
    bases.set(line.vatRate, (bases.get(line.vatRate) ?? 0) + lineTotalsList[index].net);
  });

  const vatByRate = [...bases.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rate, rawBase]) => {
      const base = roundMoney(rawBase, currency);
      return { rate, base, vat: roundMoney(base * (rate / 100), currency) };
    });

  const totalVat = roundMoney(
    vatByRate.reduce((sum, group) => sum + group.vat, 0),
    currency,
  );
  const totalTtc = roundMoney(totalNet + totalVat, currency);

  return { lines: lineTotalsList, totalNet, vatByRate, totalVat, totalTtc };
}

export function formatMoney(value: number, currency: string, locale: string): string {
  const formatted = new Intl.NumberFormat(LOCALES[locale] ?? LOCALES['en'], {
    style: 'currency',
    currency,
    currencyDisplay: 'code',
  }).format(value);
  return formatted.replace(NARROW_SPACES, ' ');
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(LOCALES[locale] ?? LOCALES['en'], {
    maximumFractionDigits: 3,
  }).format(value);
}

export function formatDate(isoDate: string, locale: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  return new Intl.DateTimeFormat(LOCALES[locale] ?? LOCALES['en'], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function addDaysIso(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

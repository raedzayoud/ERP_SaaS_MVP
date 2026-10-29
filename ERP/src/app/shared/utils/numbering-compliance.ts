/**
 * Legal numbering audit for `PREFIX-YYYY-0001` document numbers.
 * Shared by the reports numbering tab; works with any document family.
 */

export interface NumberedDoc {
  /** Full document number, e.g. "FAC-2026-0003". Blank/`null` numbers are ignored. */
  number: string;
  /** Document date used for the chronology check (issue date, order date…). */
  date: string;
}

export type NumberingStatus = 'ok' | 'gap' | 'dates';

export interface NumberingSeries {
  /** Series label without the sequence, e.g. "FAC-2026". */
  series: string;
  count: number;
  /** Highest number in the series (readable reference). */
  last: string;
  /** Missing sequences between 0001 and max, e.g. ["0002"]. */
  gaps: string[];
  /** Numbers appearing more than once. */
  duplicates: string[];
  /** First two numbers whose dates break the chronological order. */
  dateBreak: { number: string; previous: string } | null;
  status: NumberingStatus;
}

export interface NumberingFamily {
  /** i18n key of the document family (e.g. "invoices.kind.invoice"). */
  familyKey: string;
  series: NumberingSeries[];
}

const NUMBER_PATTERN = /^(.+)-(\d{4})-(\d{1,})$/;

export function analyzeNumbering(docs: NumberedDoc[]): NumberingSeries[] {
  const buckets = new Map<
    string,
    { sequence: number; date: string; number: string }[]
  >();

  for (const doc of docs) {
    const match = NUMBER_PATTERN.exec(doc.number ?? '');
    if (!match) continue;
    const series = `${match[1]}-${match[2]}`;
    const sequence = Number(match[3]);
    if (!Number.isFinite(sequence) || sequence <= 0) continue;
    const entries = buckets.get(series) ?? [];
    entries.push({ sequence, date: doc.date, number: doc.number });
    buckets.set(series, entries);
  }

  const seriesList: NumberingSeries[] = [];
  const seriesNames = [...buckets.keys()].sort();

  for (const series of seriesNames) {
    const entries = buckets.get(series)!;
    entries.sort((a, b) => a.sequence - b.sequence);

    const duplicateSequences: number[] = [];
    for (let index = 1; index < entries.length; index += 1) {
      if (entries[index].sequence === entries[index - 1].sequence) {
        duplicateSequences.push(entries[index].sequence);
      }
    }
    const duplicates = [...new Set(duplicateSequences)].map((sequence) =>
      padSequence(series, sequence),
    );

    const seen = new Set(
      entries.map((entry) => entry.sequence),
    );
    const gaps: string[] = [];
    const max = entries[entries.length - 1].sequence;
    for (let sequence = 1; sequence <= max; sequence += 1) {
      if (!seen.has(sequence)) gaps.push(padSequence(series, sequence));
    }

    let dateBreak: { number: string; previous: string } | null = null;
    for (let index = 1; index < entries.length; index += 1) {
      const current = entries[index];
      const previous = entries[index - 1];
      if (current.date < previous.date) {
        dateBreak = { number: current.number, previous: previous.number };
        break;
      }
    }

    let status: NumberingStatus = 'ok';
    if (gaps.length > 0 || duplicates.length > 0) status = 'gap';
    else if (dateBreak) status = 'dates';

    seriesList.push({
      series,
      count: seen.size,
      last: padSequence(series, max),
      gaps,
      duplicates,
      dateBreak,
      status,
    });
  }

  return seriesList;
}

function padSequence(series: string, sequence: number): string {
  const text = String(sequence);
  return `${series}-${text.length < 4 ? '0'.repeat(4 - text.length) + text : text}`;
}

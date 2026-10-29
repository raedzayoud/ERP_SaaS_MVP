import { analyzeNumbering, NumberedDoc } from './numbering-compliance';

function doc(number: string, date: string): NumberedDoc {
  return { number, date };
}

describe('analyzeNumbering', () => {
  it('marks a continuous chronological series as ok', () => {
    const result = analyzeNumbering([
      doc('FAC-2026-0001', '2026-03-01'),
      doc('FAC-2026-0002', '2026-03-10'),
      doc('FAC-2026-0003', '2026-09-20'),
    ]);

    expect(result.length).toBe(1);
    expect(result[0].status).toBe('ok');
    expect(result[0].count).toBe(3);
    expect(result[0].last).toBe('FAC-2026-0003');
    expect(result[0].gaps).toEqual([]);
    expect(result[0].duplicates).toEqual([]);
    expect(result[0].dateBreak).toBeNull();
  });

  it('detects the missing numbers of a gapped series', () => {
    const result = analyzeNumbering([
      doc('FA-2026-0001', '2026-02-01'),
      doc('FA-2026-0003', '2026-03-01'),
    ]);

    expect(result[0].status).toBe('gap');
    expect(result[0].gaps).toEqual(['FA-2026-0002']);
  });

  it('keeps series of different years and prefixes separate', () => {
    const result = analyzeNumbering([
      doc('FAC-2026-0001', '2026-01-01'),
      doc('FAC-2027-0001', '2027-01-01'),
      doc('AV-2026-0001', '2026-06-01'),
    ]);

    expect(result.map((entry) => entry.series)).toEqual([
      'AV-2026',
      'FAC-2026',
      'FAC-2027',
    ]);
    expect(result.every((entry) => entry.status === 'ok')).toBe(true);
  });

  it('flags duplicate numbers as a gap status', () => {
    const result = analyzeNumbering([
      doc('BC-2026-0001', '2026-01-05'),
      doc('BC-2026-0001', '2026-01-20'),
      doc('BC-2026-0002', '2026-02-01'),
    ]);

    expect(result[0].status).toBe('gap');
    expect(result[0].duplicates).toEqual(['BC-2026-0001']);
    expect(result[0].gaps).toEqual([]);
  });

  it('flags dates that do not follow the numbering order', () => {
    const result = analyzeNumbering([
      doc('BL-2026-0001', '2026-05-10'),
      doc('BL-2026-0002', '2026-05-02'),
    ]);

    expect(result[0].status).toBe('dates');
    expect(result[0].dateBreak).toEqual({
      number: 'BL-2026-0002',
      previous: 'BL-2026-0001',
    });
  });

  it('ignores drafts without a number and malformed numbers', () => {
    const result = analyzeNumbering([
      doc('', '2026-01-01'),
      doc('not-a-number', '2026-01-01'),
      doc('FAC-2026-1', '2026-01-10'),
    ]);

    expect(result.map((entry) => entry.series)).toEqual(['FAC-2026']);
    expect(result[0].count).toBe(1);
  });
});

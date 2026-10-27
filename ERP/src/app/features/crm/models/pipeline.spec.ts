import { isClosedStage, isOpenStage, pipelineStats } from './pipeline';

describe('pipeline helpers', () => {
  it('classifies open and closed stages', () => {
    expect(isOpenStage('qualification')).toBe(true);
    expect(isOpenStage('negotiation')).toBe(true);
    expect(isOpenStage('won')).toBe(false);

    expect(isClosedStage('won')).toBe(true);
    expect(isClosedStage('lost')).toBe(true);
    expect(isClosedStage('proposal')).toBe(false);
  });

  it('aggregates open, won and lost amounts', () => {
    const stats = pipelineStats([
      { stage: 'qualification', amount: 1000 },
      { stage: 'proposal', amount: 2000 },
      { stage: 'won', amount: 3000 },
      { stage: 'lost', amount: 0 },
    ]);

    expect(stats.openCount).toBe(2);
    expect(stats.openAmount).toBe(3000);
    expect(stats.wonAmount).toBe(3000);
    expect(stats.lostCount).toBe(1);
  });

  it('computes the win rate over closed deals only', () => {
    const stats = pipelineStats([
      { stage: 'qualification', amount: 5000 },
      { stage: 'won', amount: 1000 },
      { stage: 'lost', amount: 0 },
      { stage: 'won', amount: 3000 },
    ]);

    expect(stats.winRate).toBe(67);
  });

  it('returns a 0 win rate when nothing is closed', () => {
    const stats = pipelineStats([{ stage: 'proposal', amount: 900 }]);

    expect(stats.winRate).toBe(0);
    expect(stats.openCount).toBe(1);
  });
});

export type PipelineStage = 'qualification' | 'proposal' | 'negotiation' | 'won' | 'lost';

export const PIPELINE_STAGES: PipelineStage[] = [
  'qualification',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

export const OPEN_STAGES: PipelineStage[] = ['qualification', 'proposal', 'negotiation'];
export const CLOSED_STAGES: PipelineStage[] = ['won', 'lost'];

interface StageLike {
  stage: string;
  amount: number;
}

export interface PipelineStats {
  openCount: number;
  openAmount: number;
  wonAmount: number;
  lostCount: number;
  /** Percentage of closed deals that were won (0 when nothing is closed). */
  winRate: number;
}

export function isOpenStage(stage: string): boolean {
  return (OPEN_STAGES as string[]).includes(stage);
}

export function isClosedStage(stage: string): boolean {
  return (CLOSED_STAGES as string[]).includes(stage);
}

export function pipelineStats(list: StageLike[]): PipelineStats {
  let openCount = 0;
  let openAmount = 0;
  let wonAmount = 0;
  let lostCount = 0;
  let wonCount = 0;

  for (const item of list) {
    if (item.stage === 'won') {
      wonCount += 1;
      wonAmount += item.amount;
    } else if (item.stage === 'lost') {
      lostCount += 1;
    } else {
      openCount += 1;
      openAmount += item.amount;
    }
  }

  const closed = wonCount + lostCount;
  const winRate = closed === 0 ? 0 : Math.round((wonCount / closed) * 100);

  return { openCount, openAmount, wonAmount, lostCount, winRate };
}

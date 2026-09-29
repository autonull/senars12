import { parseNarseseTruth } from '@senars/util';
import type { TaskType } from '../../types';

export interface BootstrapGoal {
  narsese: string;
  driveId: string;
  type: TaskType;
}

export const BOOTSTRAP_GOALS: BootstrapGoal[] = [
  {
    narsese: '(self --> curious)! :0.70:0.60',
    driveId: 'curiosity',
    type: 'goal',
  },
  {
    narsese: '(self --> competent)! :0.50:0.70',
    driveId: 'competence',
    type: 'goal',
  },
  {
    narsese: '(self --> coherent)! :0.30:0.80',
    driveId: 'coherence',
    type: 'goal',
  },
];

export function createBootstrapTasks(): Array<{
  term: string;
  type: TaskType;
  truth?: { f: number; c: number };
}> {
  return BOOTSTRAP_GOALS.map((g) => ({
    term: g.narsese,
    type: g.type,
    truth: parseNarseseTruth(g.narsese),
  }));
}

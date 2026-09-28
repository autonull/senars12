import type { Concept } from '../../memory/concept.js';
import type { MemoryView } from '../../memory/view.js';
import type { Task } from '../../types';
import { samplePremisesFromConfig } from './primitives.js';
import type { FilterSpec, SampleConfig as ExtendedSampleConfig } from './primitives.js';

export type PremiseFilter = (concept: Concept, task: Task) => boolean;

export type TruthPredicate = (truth: { f: number; c: number }) => boolean;

export interface SampleConfig {
  sampleSize: number;
  limit: number;
  filter?: PremiseFilter;
  truthFilter?: TruthPredicate;
  skipSameTerm?: boolean;
  source?: 'bag' | 'concepts' | 'links' | 'taskArgs' | 'graph';
  scorer?: 'priority' | 'linkWeight' | 'edgeWeight' | 'linear' | { linear: { link: number; embed: number; pri: number } };
  filters?: FilterSpec[];
  minScore?: number;
}

const DEFAULT_CONFIG: Omit<SampleConfig, 'filter' | 'truthFilter'> & {
  filter: PremiseFilter | undefined;
  truthFilter: TruthPredicate | undefined;
} = {
  sampleSize: 20,
  limit: 10,
  filter: undefined,
  truthFilter: undefined,
  skipSameTerm: true,
};

export function samplePremises(
  memory: MemoryView,
  task: Task,
  config: Partial<SampleConfig> = {}
): Task[] {
  const { filter, truthFilter, ...composed } = config;
  const extendedConfig: ExtendedSampleConfig = {
    source: composed.source ?? 'bag',
    scorer: composed.scorer ?? 'priority',
    filters: composed.filters ?? ['sharedAtoms'],
    minScore: composed.minScore ?? 0,
    sampleSize: composed.sampleSize ?? DEFAULT_CONFIG.sampleSize,
    limit: composed.limit ?? DEFAULT_CONFIG.limit,
    skipSameTerm: composed.skipSameTerm ?? DEFAULT_CONFIG.skipSameTerm,
    where: filter ? (_task, concept) => filter(concept, _task) : undefined,
    whereTruth: truthFilter ? (_task, truth) => truthFilter(truth) : undefined,
  };
  return samplePremisesFromConfig(memory, task, extendedConfig);
}

export type { SampleConfig as ExtendedSampleConfig } from './primitives.js';
export { samplePremisesFromConfig } from './primitives.js';

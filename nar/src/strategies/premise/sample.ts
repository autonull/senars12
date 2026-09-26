import type { Concept, Memory } from '../../memory';
import { extractSymbols, termsEqual, Stamp } from '../../terms';
import type { Task } from '../../types';
import { createSecondaryTask } from '../../types';
import { samplePremisesFromConfig } from './primitives.js';
import type { SampleConfig as ExtendedSampleConfig } from './primitives.js';

const hasSharedAtoms = (term1: Task['term'], term2: Task['term']): boolean => {
  const atoms1 = extractSymbols(term1);
  const atoms2 = extractSymbols(term2);
  for (const a of atoms1) {
    if (atoms2.has(a)) return true;
  }
  return false;
};

export type PremiseFilter = (concept: Concept, task: Task) => boolean;

export type TruthPredicate = (truth: { f: number; c: number }) => boolean;

export interface SampleConfig {
  sampleSize: number;
  limit: number;
  filter?: PremiseFilter;
  truthFilter?: TruthPredicate;
  skipSameTerm?: boolean;
  source?: 'bag' | 'links' | 'taskArgs';
  scorer?: 'priority' | 'linkWeight' | { linear: { link: number; embed: number; pri: number } };
  filters?: ('sharedAtoms' | 'noStampOverlap' | 'inheritanceOnly' | 'highConfidence')[];
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
  memory: Memory,
  task: Task,
  config: Partial<SampleConfig> = {}
): Task[] {
  const extendedConfig: ExtendedSampleConfig = {
    source: config.source ?? 'bag',
    scorer: config.scorer ?? 'priority',
    filters: config.filters ?? ['sharedAtoms'],
    minScore: config.minScore ?? 0,
    sampleSize: config.sampleSize ?? DEFAULT_CONFIG.sampleSize,
    limit: config.limit ?? DEFAULT_CONFIG.limit,
    skipSameTerm: config.skipSameTerm ?? DEFAULT_CONFIG.skipSameTerm,
  };
  return samplePremisesFromConfig(memory, task, extendedConfig);
}

export type { SampleConfig as ExtendedSampleConfig } from './primitives.js';
export { samplePremisesFromConfig } from './primitives.js';

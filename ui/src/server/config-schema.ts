import type { ConfigFieldType } from '@senars/core';
import { narCoreBounds } from '@senars/util/config';
import { DEFAULT_CONFIG } from '@senars/nar';

type ConfigSchema = Record<string, ConfigFieldType>;

const DEFAULTS = { ...DEFAULT_CONFIG };

const SLIDER = (
  key: string,
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  description: string
): ConfigFieldType => ({
  type: 'slider',
  label,
  value,
  min,
  max,
  step,
  description,
  category: 'nars',
  validation: { min, max },
});

const B = narCoreBounds;

export function buildConfigSchema(overrides?: Partial<typeof DEFAULTS>): ConfigSchema {
  const v = { ...DEFAULTS, ...overrides };
  return {
    'nars.maxConcepts': SLIDER(
      'nars.maxConcepts',
      'Max Concepts',
      v.maxConcepts,
      B.maxConcepts.min,
      B.maxConcepts.max,
      B.maxConcepts.step,
      'Maximum number of concepts in working memory'
    ),
    'nars.activationDecayRate': SLIDER(
      'nars.activationDecayRate',
      'Decay Rate',
      v.activationDecayRate,
      B.activationDecayRate.min,
      B.activationDecayRate.max,
      B.activationDecayRate.step,
      'Priority decay rate per inference cycle'
    ),
    'nars.consolidationInterval': SLIDER(
      'nars.consolidationInterval',
      'Consolidation Interval',
      v.consolidationInterval,
      B.consolidationInterval.min,
      B.consolidationInterval.max,
      B.consolidationInterval.step,
      'Cycles between memory consolidation passes'
    ),
    'nars.cpuThrottleMs': SLIDER(
      'nars.cpuThrottleMs',
      'CPU Throttle (ms)',
      v.cpuThrottleMs,
      B.cpuThrottleMs.min,
      B.cpuThrottleMs.max,
      B.cpuThrottleMs.step,
      'Minimum ms to pause between cycle bursts'
    ),
    'nars.maxDerivationDepth': SLIDER(
      'nars.maxDerivationDepth',
      'Max Derivation Depth',
      v.maxDerivationDepth,
      B.maxDerivationDepth.min,
      B.maxDerivationDepth.max,
      B.maxDerivationDepth.step,
      'Maximum inference chain depth per derivation'
    ),
    'nars.maxDerivationsPerStep': SLIDER(
      'nars.maxDerivationsPerStep',
      'Max Derivations/Step',
      v.maxDerivationsPerStep,
      B.maxDerivationsPerStep.min,
      B.maxDerivationsPerStep.max,
      B.maxDerivationsPerStep.step,
      'Maximum derivations allowed per inference step'
    ),
  };
}

const KEY_TO_NAR_FIELD: Record<string, keyof typeof DEFAULTS> = {
  'nars.maxConcepts': 'maxConcepts',
  'nars.activationDecayRate': 'activationDecayRate',
  'nars.consolidationInterval': 'consolidationInterval',
  'nars.cpuThrottleMs': 'cpuThrottleMs',
  'nars.maxDerivationDepth': 'maxDerivationDepth',
  'nars.maxDerivationsPerStep': 'maxDerivationsPerStep',
};

export function applyConfigField(key: string, value: unknown): Partial<typeof DEFAULTS> | null {
  const field = KEY_TO_NAR_FIELD[key];
  if (!field) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return null;
  return { [field]: num };
}

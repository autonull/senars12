/**
 * Shared NAR construction for e2e tests — one place to express the deterministic
 * baseline config so type drift in `NARConfig`/`CognitiveParameters` breaks here, not
 * in a dozen hand-rolled literals.
 */

import { CognitiveRegistry } from '@senars/nar/cognitive/registry.js';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  type CognitiveParameters,
} from '@senars/nar/config/cognitive-parameters.js';
import { DEFAULT_CONFIG } from '@senars/nar/index.js';
import type { NARConfig } from '@senars/nar/facade/config.js';

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Recursive merge; `override` wins, arrays and primitives replace wholesale. */
export const deepMerge = <T>(base: T, override: unknown): T => {
  if (!isPlainObject(base) || !isPlainObject(override)) return override as T;
  const merged: PlainObject = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  }
  return merged as T;
};

/** Deterministic default registry with every built-in strategy registered. */
export const e2eStrategyRegistry = (): CognitiveRegistry => {
  const registry = new CognitiveRegistry();
  registry.initializeDefaults();
  return registry;
};

/** Deterministic cognitive parameters: LM off, tracing on, no CPU throttle. */
export const e2eCognitiveParams = (overrides?: DeepPartial<CognitiveParameters>): CognitiveParameters =>
  deepMerge(
    deepMerge(DEFAULT_COGNITIVE_PARAMETERS, {
      strategies: {
        sampling: { type: 'priority' },
        premise: { type: 'default-formation' },
        derivation: { type: 'default' },
        lmRule: { type: 'priority', maxRules: 10 },
        attention: { type: 'simple' },
      },
      lm: { enabled: false },
    }) as CognitiveParameters,
    overrides
  );

/** Baseline e2e `NARConfig`: no LM, no tools, no throttle, full concept budget. */
export const e2eNARConfig = (overrides?: Partial<NARConfig>): NARConfig => ({
  ...DEFAULT_CONFIG,
  cpuThrottleMs: 0,
  enableLMRules: false,
  enableTools: false,
  enableSelf: false,
  enableRLFP: false,
  cognitiveParams: e2eCognitiveParams(),
  strategyRegistry: e2eStrategyRegistry(),
  ...overrides,
});

type DeepPartial<T> = T extends readonly unknown[]
  ? T
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

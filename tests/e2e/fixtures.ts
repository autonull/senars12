/**
 * Shared NAR construction for e2e tests — one place to express the deterministic
 * baseline config so type drift in `NARConfig`/`CognitiveParameters` breaks here, not
 * in a dozen hand-rolled literals.
 */

import { CognitiveRegistry } from '@senars/nar/cognitive/impls/CognitiveRegistry.js';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  type CognitiveParameters,
} from '@senars/nar/config/cognitive-parameters.js';
import { DEFAULT_CONFIG } from '@senars/nar/index.js';
import type { NARConfig } from '@senars/nar/facade/config.js';
import { deepMerge } from '@senars/util';

/** Deterministic default registry with every built-in strategy registered. */
export const e2eStrategyRegistry = (): CognitiveRegistry => {
  const registry = new CognitiveRegistry();
  registry.initializeDefaults();
  return registry;
};

/** Deterministic cognitive parameters: LM off, tracing on, no CPU throttle. */
export const e2eCognitiveParams = (
  overrides?: DeepPartial<CognitiveParameters>
): CognitiveParameters =>
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

/** Polls `predicate` until it yields a defined value; rejects on timeout. */
export const waitFor = <T>(predicate: () => T | undefined, timeoutMs = 15_000): Promise<T> =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const result = predicate();
      if (result !== undefined) return resolve(result);
      if (Date.now() - start > timeoutMs) return reject(new Error('waitFor timed out'));
      setTimeout(check, 20);
    };
    check();
  });

/** Resolves with the first message in the (growing) buffer matching `predicate`. */
export const waitForMessage = <T>(
  messages: readonly T[],
  predicate: (message: T) => boolean,
  timeoutMs = 5000
): Promise<T> =>
  waitFor(() => messages.find(predicate), timeoutMs).catch((err: unknown) => {
    throw new Error(
      `waitForMessage timed out: ${err instanceof Error ? err.message : String(err)}`
    );
  });

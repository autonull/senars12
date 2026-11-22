/**
 * Loop Context — creates and manages the loop execution context.
 */

import { createActionSelector, type ActionSelector } from './select';
import { createLoopRecorder, type LoopRecorder } from './record';
import { createSelfModelManager, type SelfModelManager } from './self-model';
import type { ContractRegistry } from './contract';
import { createRepairLoop, type RepairLoop } from './repair';
import type { Economy, EconomyScheduler } from '../economy/index';
import type { FacultyRegistry } from '../faculties/specs';
import type { OracleRegistry } from '../oracles/oracle';
import type { Env, RNG, Clock } from '../kernel/env';
import type { LoopConfig, LoopContext, FacultyInvoker, FacultySpec, FacultyInput, FacultyOutput } from './types';
import { defaultLoopConfig } from './types';

/** Creates the loop context with all dependencies. */
export function createLoopContext(
  env: Env,
  economy: Economy,
  scheduler: EconomyScheduler,
  faculties: FacultyRegistry,
  oracles: OracleRegistry,
  config: Partial<LoopConfig> = {}
): LoopContext {
  const mergedConfig = { ...defaultLoopConfig, ...config };
  const correlationId = mergedConfig.correlationId ?? env.ids.uuid();

  const recorder = mergedConfig.recordEnabled ? createLoopRecorder(undefined, correlationId, { clock: env.clock, ids: env.ids }) : undefined;
  const selfModel = mergedConfig.selfModelEnabled ? createSelfModelManager(undefined, { clock: env.clock }) : undefined;
  const selector = createActionSelector(undefined, { rng: env.rng, clock: env.clock });
  const repair = mergedConfig.repairEnabled ? createRepairLoop(undefined, { clock: env.clock }) : undefined;

  return {
    iteration: 0,
    env,
    economy,
    scheduler,
    faculties,
    oracles,
    contracts: undefined,
    repair,
    recorder,
    selfModel,
    selector,
    config: mergedConfig,
    correlationId,
  };
}

/** Initializes faculty invokers from the faculty registry. */
export function initializeFacultyInvokers(faculties: FacultyRegistry): Map<string, FacultyInvoker> {
  const invokers = new Map<string, FacultyInvoker>();

  // Access specs via the public getAll() method
  for (const spec of faculties.getAll()) {
    invokers.set(spec.name, {
      spec,
      invoke: async (input: FacultyInput): Promise<FacultyOutput> => {
        // Try fallback first
        try {
          const fallbackResult = await spec.fallback(input);
          if (fallbackResult) return fallbackResult;
        } catch {
          // Fallback failed, would try oracle in full implementation
        }

        // Default fallback output
        return {
          faculty: spec.name,
          result: null,
          confidence: 0.5,
          durationMs: 0,
        };
      },
    });
  }

  return invokers;
}
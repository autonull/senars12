/**
 * Shared demo infrastructure.
 */

import { createEnv } from '@senars/kernel/env';
import { createOracleRegistry } from '@senars/oracles';
import { createFacultyRegistry } from '@senars/faculties';
import { createCognitiveLoop } from '@senars/loop';
import { createLogStore } from '@senars/log/store';

export interface DemoConfig {
  name: string;
  seed: number;
  iterations: number;
  selfModelEnabled?: boolean;
  repairEnabled?: boolean;
  steps?: Array<() => Promise<void>>;
}

export interface DemoResult {
  demo: string;
  seed: number;
  digest: string;
  steps: number;
  [key: string]: unknown;
}

export async function runDemo(config: DemoConfig): Promise<DemoResult> {
  const logStore = createLogStore({ path: `.data/${config.name}.log`, maxBytes: 10_000_000 });

  const core = { seed: config.seed, clock: { now: () => Date.now() } };
  const env = createEnv({
    ...core,
    oracles: createOracleRegistry(),
    faculties: createFacultyRegistry(),
    log: logStore,
  });

  const loop = createCognitiveLoop(env, null as any, null as any, createFacultyRegistry(), createOracleRegistry(), {
    maxIterations: config.iterations,
    recordEnabled: true,
    contractsEnabled: false,
    repairEnabled: config.repairEnabled ?? false,
    selfModelEnabled: config.selfModelEnabled ?? false,
  });

  if (config.steps) {
    for (const step of config.steps) {
      await step();
    }
  }

  const digest = await logStore.digest();
  return { demo: config.name, seed: config.seed, digest, steps: config.iterations };
}

export function createStepFn(loop: any, message: string) {
  return () => loop.step(message);
}
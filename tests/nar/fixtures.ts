/**
 * Test fixtures - Shared test utilities
 */
import { DEFAULT_CONFIG, NAR } from '@senars/nar';

export const E2E_CONFIG = {
  maxConcepts: 100,
  activationDecayRate: 0.01,
  consolidationInterval: 5,
  cpuThrottleMs: 10,
  maxDerivationDepth: 10,
  maxDerivationsPerStep: 100,
} as const;

export const createTestNAR = (overrides?: Partial<typeof E2E_CONFIG>) =>
  new NAR({
      ...DEFAULT_CONFIG, ...E2E_CONFIG, ...overrides });

/**
 * Test fixtures - Shared test utilities
 */
import {NAR} from '../nar.js';

export const E2E_CONFIG = {
    maxConcepts: 100,
    priorityThreshold: 0.1,
    activationDecayRate: 0.01,
    consolidationInterval: 5,
    cpuThrottleMs: 10,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100,
    enableLMRules: false
} as const;

export const createTestNAR = (overrides?: Partial<typeof E2E_CONFIG>) => new NAR({...E2E_CONFIG, ...overrides});

/**
 * Kernel-level NAR construction for tests/benches that need a bare `NAR`.
 * Agent assembly goes through `NARBuilder` (`nar/src/agent/builder.ts`) — TODO19 F1.
 */

import type { CognitiveRegistry } from './cognitive';
import { createLMService, createSeNARSRegistry, type SeNARSRegistry } from './lm';
import type { LMService } from './lm/lm-service.js';
import type { NARConfig, SystemOneConfig } from './nar.js';
import { NAR } from './nar.js';
import type { CoreConfig } from './types';
import { DEFAULT_CONFIG, EventBus } from './types';

export interface SeNARSOptions {
  core?: Partial<CoreConfig>;
  lmService?: LMService;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  eventBus?: EventBus;
  // Feature flags / config forwarded to NARConfig
  enableTools?: boolean;
  enableSelf?: boolean;
  enableRLFP?: boolean;
  persistState?: boolean;
  statePath?: string;
  maxConcepts?: number;
  cognitiveParams?: NARConfig['cognitiveParams'];
  strategyRegistry?: CognitiveRegistry;
  // System One configuration
  systemOne?: Partial<SystemOneConfig>;
}

const MINIMAL_CONFIG: CoreConfig = {
  ...DEFAULT_CONFIG,
  maxConcepts: 100,
  cpuThrottleMs: 0,
  maxDerivationsPerStep: 100,
};
const BOT_CONFIG: CoreConfig = { ...DEFAULT_CONFIG };
const TEST_CONFIG: CoreConfig = {
  ...DEFAULT_CONFIG,
  maxConcepts: 100,
  activationDecayRate: 0,
  consolidationInterval: 1000,
  cpuThrottleMs: 0,
  maxDerivationDepth: 20,
};

/** Default kernel: LM rules on, isolated provider registry/event bus. */
export function createNAR(options: SeNARSOptions = {}): NAR {
  const config = {
    ...DEFAULT_CONFIG,
    ...options.core,
    // Forward feature flags only when explicitly provided (so CoreConfig defaults hold).
    ...(options.enableTools !== undefined ? { enableTools: options.enableTools } : {}),
    ...(options.enableSelf !== undefined ? { enableSelf: options.enableSelf } : {}),
    ...(options.enableRLFP !== undefined ? { enableRLFP: options.enableRLFP } : {}),
    ...(options.persistState !== undefined ? { persistState: options.persistState } : {}),
    ...(options.statePath !== undefined ? { statePath: options.statePath } : {}),
    ...(options.maxConcepts !== undefined ? { maxConcepts: options.maxConcepts } : {}),
    ...(options.cognitiveParams !== undefined ? { cognitiveParams: options.cognitiveParams } : {}),
    ...(options.strategyRegistry !== undefined
      ? { strategyRegistry: options.strategyRegistry }
      : {}),
    ...(options.systemOne !== undefined ? { systemOne: options.systemOne } : {}),
    enableLMRules: options.enableLMRules ?? true,
    lmService: options.lmService ?? createLMService(),
    providerRegistry: options.providerRegistry ?? createSeNARSRegistry(),
    eventBus: options.eventBus ?? new EventBus(),
  } as NARConfig & { eventBus?: EventBus };
  return new NAR(config);
}

/** Bot kernel: no LM wired, default limits. */
export function createBotNAR(options?: { maxConcepts?: number }): NAR {
  return new NAR({ ...BOT_CONFIG, maxConcepts: options?.maxConcepts ?? BOT_CONFIG.maxConcepts });
}

/** Minimal kernel: tiny budgets, no throttle. */
export function createMinimalNAR(): NAR {
  return new NAR(MINIMAL_CONFIG);
}

/** Deterministic test kernel: decay off, small depth, optional LM. */
export function createTestNAR(options?: { maxConcepts?: number; lmService?: LMService }): NAR {
  return new NAR({
    ...TEST_CONFIG,
    maxConcepts: options?.maxConcepts ?? TEST_CONFIG.maxConcepts,
    ...(options?.lmService ? { lmService: options.lmService } : {}),
    providerRegistry: createSeNARSRegistry(),
  });
}

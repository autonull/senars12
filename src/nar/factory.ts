/**
 * NAR Factory - Creates configured NAR instances
 * Separates configuration from construction
 */

import { NAR } from './nar.js';
import type { NARConfig } from './nar.js';
import type { LMClient } from './lm/types.js';
import type { CoreConfig } from './types/index.js';
import { DEFAULT_CONFIG } from './types/index.js';

export interface SeNARSOptions {
  core?: Partial<CoreConfig>;
  lmClient?: LMClient;
  enableLMRules?: boolean;
}

export interface SeNARSConfig {
  name: string;
  version: string;
  nar: NARConfig;
  lm?: {
    enabled: boolean;
    provider: string;
    model?: string;
  };
}

export class SeNARSFactory {
  static createDefault(options: SeNARSOptions = {}): NAR {
    const config: NARConfig = {
      ...DEFAULT_CONFIG,
      ...options.core,
      enableLMRules: options.enableLMRules ?? false,
      lmClient: options.lmClient ?? undefined
    };

    return new NAR(config);
  }

  static fromConfig(config: SeNARSConfig, lmClient?: LMClient | null): NAR {
    const narConfig: NARConfig = {
      ...config.nar,
      enableLMRules: config.lm?.enabled ?? false,
      lmClient: config.lm?.enabled ? lmClient ?? undefined : undefined
    };

    return new NAR(narConfig);
  }

  static createMinimal(): NAR {
    return new NAR({
      maxConcepts: 100,
      priorityThreshold: 0.1,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
      cpuThrottleMs: 0,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 100
    });
  }

  static createForCLI(options?: { maxConcepts?: number; maxDerivationDepth?: number }): NAR {
    return new NAR({
      maxConcepts: options?.maxConcepts ?? 200,
      priorityThreshold: 0.1,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
      cpuThrottleMs: 0,
      maxDerivationDepth: options?.maxDerivationDepth ?? 10,
      maxDerivationsPerStep: 100
    });
  }

  static createForBot(options?: { maxConcepts?: number }): NAR {
    return new NAR({
      maxConcepts: options?.maxConcepts ?? 1000,
      priorityThreshold: 0.5,
      activationDecayRate: 0.01,
      consolidationInterval: 10,
      cpuThrottleMs: 10,
      maxDerivationDepth: 10,
      maxDerivationsPerStep: 1000
    });
  }

  static createForTesting(options?: { maxConcepts?: number }): NAR {
    return new NAR({
      maxConcepts: options?.maxConcepts ?? 100,
      priorityThreshold: 0.0,
      activationDecayRate: 0.0,
      consolidationInterval: 1000,
      cpuThrottleMs: 0,
      maxDerivationDepth: 20,
      maxDerivationsPerStep: 1000
    });
  }
}

export const createNAR = SeNARSFactory.createDefault;
export const createMinimalNAR = SeNARSFactory.createMinimal;

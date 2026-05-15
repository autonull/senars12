/**
 * NAR Factory - Creates configured NAR instances
 * Separates configuration from construction
 */

import type {NARConfig} from './nar.js';
import {NAR} from './nar.js';
import type {LMClient} from './lm';
import type {CoreConfig} from './types';
import {DEFAULT_CONFIG} from './types';
import {setupDefaultLMClient} from './lm/defaults.js';
import {createSeNARSRegistry, type SeNARSRegistry} from './lm/providers.js';

export interface SeNARSOptions {
    core?: Partial<CoreConfig>;
    lmClient?: LMClient;
    providerRegistry?: SeNARSRegistry;
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

const BASE_CONFIG = {
    activationDecayRate: 0.01,
    consolidationInterval: 10,
} as const;

const MINIMAL_CONFIG = {
    ...BASE_CONFIG,
    maxConcepts: 100,
    priorityThreshold: 0.1,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100
} as const;
const CLI_CONFIG = {
    ...BASE_CONFIG,
    maxConcepts: 200,
    priorityThreshold: 0.1,
    cpuThrottleMs: 0,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 100
} as const;
const BOT_CONFIG = {
    ...BASE_CONFIG,
    maxConcepts: 1000,
    priorityThreshold: 0.5,
    cpuThrottleMs: 10,
    maxDerivationDepth: 10,
    maxDerivationsPerStep: 1000
} as const;
const TEST_CONFIG = {
    ...BASE_CONFIG,
    maxConcepts: 100,
    priorityThreshold: 0.0,
    activationDecayRate: 0.0,
    consolidationInterval: 1000,
    cpuThrottleMs: 0,
    maxDerivationDepth: 20,
    maxDerivationsPerStep: 1000
} as const;

export class SeNARSFactory {
    static createDefault(options: SeNARSOptions = {}): NAR {
        const registry = options.providerRegistry ?? createSeNARSRegistry();
        const lmClient = options.lmClient ?? setupDefaultLMClient();
        const config: NARConfig = {
            ...DEFAULT_CONFIG, ...options.core,
            enableLMRules: options.enableLMRules ?? true,
            lmClient,
            providerRegistry: registry,
        };
        return new NAR(config);
    }

    static fromConfig(config: SeNARSConfig, lmClient?: LMClient | null, registry?: SeNARSRegistry | null): NAR {
        const narConfig: NARConfig = {
            ...config.nar,
            enableLMRules: config.lm?.enabled ?? false,
            lmClient: config.lm?.enabled ? lmClient ?? setupDefaultLMClient() : undefined,
            providerRegistry: registry ?? createSeNARSRegistry(),
        };
        return new NAR(narConfig);
    }

    static createMinimal(): NAR {
        return new NAR(MINIMAL_CONFIG);
    }

    static createForCLI(options?: { maxConcepts?: number; maxDerivationDepth?: number }): NAR {
        return new NAR({
            ...CLI_CONFIG,
            maxConcepts: options?.maxConcepts ?? CLI_CONFIG.maxConcepts,
            maxDerivationDepth: options?.maxDerivationDepth ?? CLI_CONFIG.maxDerivationDepth
        });
    }

    static createForBot(options?: { maxConcepts?: number }): NAR {
        return new NAR({...BOT_CONFIG, maxConcepts: options?.maxConcepts ?? BOT_CONFIG.maxConcepts});
    }

    static createForTesting(options?: { maxConcepts?: number }): NAR {
        return new NAR({...TEST_CONFIG, maxConcepts: options?.maxConcepts ?? TEST_CONFIG.maxConcepts});
    }
}

export const createNAR = SeNARSFactory.createDefault;
export const createMinimalNAR = SeNARSFactory.createMinimal;

/**
 * NAR Factory - Creates configured NAR instances
 * Separates configuration from construction
 */

import type {NARConfig} from './nar.js';
import {NAR} from './nar.js';
import type {LMClient} from './lm';
import type {CoreConfig} from './types';
import {DEFAULT_CONFIG} from './types';

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

const PRESETS = {
    minimal: { maxConcepts: 100, priorityThreshold: 0.1, activationDecayRate: 0.01, consolidationInterval: 10, cpuThrottleMs: 0, maxDerivationDepth: 10, maxDerivationsPerStep: 100 },
    cli: { maxConcepts: 200, priorityThreshold: 0.1, activationDecayRate: 0.01, consolidationInterval: 10, cpuThrottleMs: 0, maxDerivationDepth: 10, maxDerivationsPerStep: 100 },
    bot: { maxConcepts: 1000, priorityThreshold: 0.5, activationDecayRate: 0.01, consolidationInterval: 10, cpuThrottleMs: 10, maxDerivationDepth: 10, maxDerivationsPerStep: 1000 },
    test: { maxConcepts: 100, priorityThreshold: 0.0, activationDecayRate: 0.0, consolidationInterval: 1000, cpuThrottleMs: 0, maxDerivationDepth: 20, maxDerivationsPerStep: 1000 }
} as const;

type PresetName = keyof typeof PRESETS;

function createFromPreset<T extends Partial<CoreConfig>>(name: PresetName, options?: T): NAR {
    return new NAR({ ...PRESETS[name], ...options });
}

export class SeNARSFactory {
    static createDefault(options: SeNARSOptions = {}): NAR {
        return new NAR({ ...DEFAULT_CONFIG, ...options.core, enableLMRules: options.enableLMRules ?? false, lmClient: options.lmClient ?? undefined });
    }

    static fromConfig(config: SeNARSConfig, lmClient?: LMClient | null): NAR {
        return new NAR({ ...config.nar, enableLMRules: config.lm?.enabled ?? false, lmClient: config.lm?.enabled ? lmClient ?? undefined : undefined });
    }

    static createMinimal(): NAR {
        return createFromPreset('minimal');
    }

    static createForCLI(options?: { maxConcepts?: number; maxDerivationDepth?: number }): NAR {
        return createFromPreset('cli', options);
    }

    static createForBot(options?: { maxConcepts?: number }): NAR {
        return createFromPreset('bot', options);
    }

    static createForTesting(options?: { maxConcepts?: number }): NAR {
        return createFromPreset('test', options);
    }
}

export const createNAR = SeNARSFactory.createDefault;
export const createMinimalNAR = SeNARSFactory.createMinimal;

/**
 * NAR Factory - Creates configured NAR instances
 * Separates configuration from construction
 */

import type {NARConfig} from './nar.js';
import {NAR} from './nar.js';
import type {LMClient} from './lm';
import type {RLFPLearner} from './rlfp';
import type {CoreConfig} from './types';
import {DEFAULT_CONFIG, EventBus} from './types';
import {setupDefaultLMClient} from './lm/defaults.js';
import {createSeNARSRegistry, type SeNARSRegistry} from './lm/providers.js';
import {CognitiveRegistry} from './cognitive/registry';
import {DEFAULT_COGNITIVE_PARAMETERS, RESEARCH_COGNITIVE_CONFIG, mergeParameters} from './config/cognitive-parameters';
import type {CognitiveParameters} from './config/cognitive-parameters';

export interface SeNARSOptions {
  core?: Partial<CoreConfig>;
  lmClient?: LMClient;
  providerRegistry?: SeNARSRegistry;
  enableLMRules?: boolean;
  eventBus?: EventBus;
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

export interface CognitiveOptions {
    registry?: CognitiveRegistry;
    core?: Partial<CoreConfig>;
    adaptationInterval?: number;
    rlfp?: RLFPLearner;
}

const MINIMAL_CONFIG: CoreConfig = {
    ...DEFAULT_CONFIG,
    maxConcepts: 100,
    cpuThrottleMs: 0,
    maxDerivationsPerStep: 100
};
const CLI_CONFIG: CoreConfig = {
    ...DEFAULT_CONFIG,
    maxConcepts: 200,
    cpuThrottleMs: 0,
    maxDerivationsPerStep: 100
};
const BOT_CONFIG: CoreConfig = {...DEFAULT_CONFIG};
const TEST_CONFIG: CoreConfig = {
    ...DEFAULT_CONFIG,
    maxConcepts: 100,
    activationDecayRate: 0,
    consolidationInterval: 1000,
    cpuThrottleMs: 0,
    maxDerivationDepth: 20
};

export class SeNARSFactory {
  static createDefault(options: SeNARSOptions = {}): NAR {
    const registry = options.providerRegistry ?? createSeNARSRegistry();
    const lmClient = options.lmClient ?? setupDefaultLMClient();
    const eventBus = options.eventBus ?? new EventBus();
    const config: NARConfig & { eventBus?: EventBus } = {
      ...DEFAULT_CONFIG, ...options.core,
      enableLMRules: options.enableLMRules ?? true,
      lmClient,
      providerRegistry: registry,
      eventBus,
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

    /** Create NAR with cognitive architecture enabled */
    static createWithStrategies(
        params?: Partial<CognitiveParameters>,
        options?: CognitiveOptions
    ): NAR {
        const registry = options?.registry ?? new CognitiveRegistry();
        registry.initializeDefaults();

        const merged = mergeParameters({
            ...DEFAULT_COGNITIVE_PARAMETERS,
            ...params,
            strategies: {
                ...DEFAULT_COGNITIVE_PARAMETERS.strategies,
                ...params?.strategies,
                sampling:   { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.sampling, ...params?.strategies?.sampling },
                premise:    { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.premise, ...params?.strategies?.premise },
                derivation: { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.derivation, ...params?.strategies?.derivation },
                lmRule:     { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.lmRule, ...params?.strategies?.lmRule },
                attention:  { ...DEFAULT_COGNITIVE_PARAMETERS.strategies.attention, ...params?.strategies?.attention }
            }
        });

        const nar = new NAR({
            ...DEFAULT_CONFIG,
            ...options?.core,
            cognitiveParams: merged,
            strategyRegistry: registry,
            adaptationInterval: options?.adaptationInterval ?? 50
        });

        if (options?.rlfp) nar.setRLFP(options.rlfp);
        return nar;
    }

    /** Default cognitive NAR — balanced for general use */
    static createCognitiveDefault(): NAR {
        return SeNARSFactory.createWithStrategies();
    }

    /** Fast inference — minimal LM, focused derivation, top-n sampling */
    static createCognitiveFast(): NAR {
        return SeNARSFactory.createWithStrategies({
            strategies: {
                premise: { type: 'bag' },
                lmRule: { type: 'priority', maxRules: 3 },
                derivation: { type: 'focused' },
                attention: { type: 'simple' },
                sampling: { type: 'top-n' }
            }
        });
    }

    /** Research mode — all tracing enabled, diverse strategies registered */
    static createCognitiveResearch(): NAR {
        const registry = new CognitiveRegistry();
        registry.initializeDefaults();
        return SeNARSFactory.createWithStrategies(RESEARCH_COGNITIVE_CONFIG, { registry });
    }
}

export const createNAR = SeNARSFactory.createDefault;
export const createMinimalNAR = SeNARSFactory.createMinimal;

/**
 * Shared default configurations for SeNARS entry points
 */

import type {NARConfig} from '../nar/nar.js';

export const DEFAULT_NAR_CORE_CONFIG: Partial<NARConfig> = {
    maxConcepts: 100,
    maxDerivationDepth: 10,
} as const;

export const DEFAULT_NAR_CONFIG: Partial<NARConfig> = {
    ...DEFAULT_NAR_CORE_CONFIG,
    enableLMRules: true,
} as const;

export const DEFAULT_BOT_CONFIG = {
    auth: {mode: 'open' as 'open' | 'auth'},
    degradation: {
        lmHealthCheckInterval: 30000,
        fallbackEnabled: true,
    },
    channel: {defaultType: 'irc' as const},
    conversation: {maxHistoryPerUser: 20, maxAgeMs: 3600000},
    agenticLoop: {
        reasoningStepsPerWake: 5,
        wakeupIntervalMs: 60000,
        sleepIntervalMs: 1000,
        enableLMRules: true,
        effortLevel: 0.3,
        priorityThreshold: 0.5,
    },
    responseInterpreter: {
        enabled: true,
        autoBelieveNarsese: true,
        autoExecuteTools: true,
    },
} as const;

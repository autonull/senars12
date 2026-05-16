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

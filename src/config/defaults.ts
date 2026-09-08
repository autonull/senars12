import type {NARConfig} from '../../nar/src';
import type {AppConfig, BotConfig, BotProfile} from './schema.js';
import {appConfigSchema, botConfigSchema, botProfileSchema} from './schema.js';

export const DEFAULT_NAR_CORE_CONFIG: Partial<NARConfig> = {
    maxConcepts: 100,
    maxDerivationDepth: 10,
} as const;

export const DEFAULT_NAR_CONFIG: Partial<NARConfig> = {
    ...DEFAULT_NAR_CORE_CONFIG,
    enableLMRules: true,
} as const;

export const DEFAULT_BOT_CONFIG: BotConfig = botConfigSchema.parse({});
export const DEFAULT_PROFILE: BotProfile = botProfileSchema.parse({});
export const DEFAULT_APP_CONFIG: AppConfig = appConfigSchema.parse({});

export const makeDefaultBotConfig = (overrides?: Partial<BotConfig>): BotConfig =>
    botConfigSchema.parse(overrides ?? {});

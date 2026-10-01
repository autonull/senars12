import type { NARConfig } from '@senars/nar';
import { deepFreeze } from '@senars/util';
import type { AppConfig, BotConfig, BotProfile } from './schema.js';
import { appConfigSchema, botConfigSchema, botProfileSchema } from './schema.js';

export const DEFAULT_NAR_CORE_CONFIG: Partial<NARConfig> = {
  maxConcepts: 100,
  maxDerivationDepth: 10,
} as const;

export const DEFAULT_NAR_CONFIG: Partial<NARConfig> = {
  ...DEFAULT_NAR_CORE_CONFIG,
} as const;

/** §5n follow-up: frozen at module load — mutation throws in strict mode. */
export const DEFAULT_BOT_CONFIG: BotConfig = deepFreeze(botConfigSchema.parse({}));
export const DEFAULT_PROFILE: BotProfile = deepFreeze(botProfileSchema.parse({}));
export const DEFAULT_APP_CONFIG: AppConfig = deepFreeze(appConfigSchema.parse({}));

export const makeDefaultBotConfig = (overrides?: Partial<BotConfig>): BotConfig =>
  botConfigSchema.parse(overrides ?? {});

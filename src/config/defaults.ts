import type { NARConfig } from '@senars/nar';
import { narCoreDefaults } from '@senars/util/config';
import { deepFreeze } from '@senars/util';
import type { AppConfig, BotConfig, BotProfile } from './schema.js';
import { appConfigSchema, botConfigSchema, botProfileSchema } from './schema.js';

/**
 * The NAR core knobs a NAR constructed from this app config starts with, taken
 * from the same bounds table the engine's own `DEFAULT_CONFIG` reads — this used
 * to be a second hand-written copy that had drifted to `maxConcepts: 100` against
 * the table's 1000, and nothing could have noticed because nothing consumed the
 * divergence. One table, one answer.
 */
export const DEFAULT_NAR_CORE_CONFIG: Partial<NARConfig> = narCoreDefaults;

/** §5n follow-up: frozen at module load — mutation throws in strict mode. */
export const DEFAULT_BOT_CONFIG: BotConfig = deepFreeze(botConfigSchema.parse({}));
export const DEFAULT_PROFILE: BotProfile = deepFreeze(botProfileSchema.parse({}));
export const DEFAULT_APP_CONFIG: AppConfig = deepFreeze(appConfigSchema.parse({}));

export const makeDefaultBotConfig = (overrides?: Partial<BotConfig>): BotConfig =>
  botConfigSchema.parse(overrides ?? {});

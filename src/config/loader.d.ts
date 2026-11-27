import { CURRENT_CONFIG_VERSION } from '@senars/util/config-migrate';
import type { AppConfig } from './schema';
export type { AppConfig, BotConfig, BotProfile, LmConfig, NarCoreConfig } from './schema';
export declare const loadConfig: (path?: string) => Promise<AppConfig>;
export declare const loadConfigFromEnv: () => Promise<AppConfig>;
export { CURRENT_CONFIG_VERSION };
//# sourceMappingURL=loader.d.ts.map
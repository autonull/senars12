import type { LMSettings, LMSettingsInput } from '../env-config.js';
import { delegate, type LMProviderName } from '../provider-runtime.js';

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = delegate('configureLM');

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = delegate('getLMSettings');

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

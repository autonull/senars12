import type { LMSettings, LMSettingsInput } from '../env-config.js';
import { delegate, type LMProviderName } from '../provider-runtime.js';

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = delegate('configureLM');

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = delegate('getLMSettings');

/** Select the runtime-active provider (and optional model) — instant, no rebuild. */
export const setActiveProvider = delegate('setActiveProvider');

/** The runtime provider selection, or undefined when env/config decides. */
export const getActiveProvider = delegate('getActiveProvider');

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

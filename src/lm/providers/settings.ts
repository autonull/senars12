import type { LMSettings, LMSettingsInput } from '../env-config.js';
import { delegate, type LMProviderName } from '../provider-runtime.js';

/** Install file/config-derived settings (env still wins at read time). */
export const configureLM = (...args: unknown[]) => delegate('configureLM')(...args);

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = (...args: unknown[]) => delegate('getLMSettings')(...args);

/** Select the runtime-active provider (and optional model) — instant, no rebuild. */
export const setActiveProvider = (...args: unknown[]) => delegate('setActiveProvider')(...args);

/** The runtime provider selection, or undefined when env/config decides. */
export const getActiveProvider = (...args: unknown[]) => delegate('getActiveProvider')(...args);

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

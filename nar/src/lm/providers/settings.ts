import type { LMSettings, LMSettingsInput } from '../env-config.js';
import {
  getProviderRuntime,
  type LMProviderName,
  type ProviderRuntime,
} from '../provider-runtime.js';

export const configureLM = (
  settings: LMSettingsInput,
  rt: ProviderRuntime = getProviderRuntime()
): void => {
  rt.configureLM(settings);
};

/** Active settings, lazily resolved from env (+ anything installed via configureLM). */
export const getLMSettings = (rt: ProviderRuntime = getProviderRuntime()): LMSettings =>
  rt.getLMSettings();

export const getLmProvider = (): LMProviderName => getLMSettings().provider;

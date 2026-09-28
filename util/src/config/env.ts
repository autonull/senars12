/**
 * Standardized `SENARS_*` environment variable → config path mapping.
 * Single source of truth for env-driven configuration overrides.
 * @public
 */

import { setNested } from '../utils/shared.js';

export const SENARS_ENV_MAP: Readonly<Record<string, string>> = {
  SENARS_LM_ENABLED: 'capabilities.lm.enabled',
  SENARS_LM_PROVIDER: 'capabilities.lm.provider',
  SENARS_LM_MODEL: 'capabilities.lm.model',
  SENARS_SENARS_ENABLED: 'capabilities.senars.enabled',
} as const;

export function parseEnvValue(value: string): unknown {
  if (value.toLowerCase() === 'true' || value === '1') return true;
  if (value.toLowerCase() === 'false' || value === '0') return false;
  const num = Number(value);
  if (!Number.isNaN(num)) return num;
  return value;
}

export function readEnvOverrides(env: NodeJS.ProcessEnv = process.env): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [envKey, configPath] of Object.entries(SENARS_ENV_MAP)) {
    const envValue = env[envKey];
    if (envValue !== undefined) {
      setNested(out, configPath, parseEnvValue(envValue));
    }
  }
  return out;
}

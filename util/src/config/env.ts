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

const TRUTHY_SPELLINGS = new Set(['true', '1', 'yes', 'on']);
const FALSY_SPELLINGS = new Set(['false', '0', 'no', 'off']);

/** Canonical truthiness for env-sourced strings — every `=== 'true'` check funnels here. */
export const isTruthy = (value: string | undefined): boolean =>
  value !== undefined && TRUTHY_SPELLINGS.has(value.toLowerCase());

/** Exact complement of {@link isTruthy}. The two together are the whole boolean grammar. */
export const isFalsy = (value: string | undefined): boolean =>
  value !== undefined && FALSY_SPELLINGS.has(value.toLowerCase());

/** True only for a spelling both halves accept — the acceptance test a validator wants. */
export const isBooleanSpelling = (value: string | undefined): boolean =>
  isTruthy(value) || isFalsy(value);

/** First defined value among `keys`, or `undefined`. */
export const envFirst = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value !== undefined && value !== '') return value;
  }
  return undefined;
};

export const envStr = (...keys: string[]): string | undefined => envFirst(...keys);

export const envStrOr = (fallback: string, ...keys: string[]): string =>
  envFirst(...keys) ?? fallback;

export const envBool = (key: string, fallback = false): boolean => {
  const value = process.env[key];
  return value === undefined ? fallback : isTruthy(value);
};

export const envInt = (key: string, fallback: number): number => {
  const value = process.env[key];
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

/**
 * Finite real number from the first defined alias, or `undefined` when the key is
 * absent, empty, or unparseable. This is the `?? file?.field` shape: a typo'd env
 * value falls through to the file instead of installing `NaN` into typed settings.
 */
export const envNumOr = (...keys: string[]): number | undefined => {
  const value = envFirst(...keys);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Finite real number from the environment, else `fallback`. Unlike `envInt`
 *  this keeps fractional values and rejects `NaN`/`Infinity` — the shape caps
 *  and sizes need, where `parseInt` would silently floor `1.5` to `1`. */
export const envNum = (key: string, fallback: number): number => envNumOr(key) ?? fallback;

/** Positive finite number from the environment, else `fallback` — the guard for
 *  limits and caps, where a non-positive value means "unset", not "zero". */
export const envPositive = (key: string, fallback: number): number => {
  const parsed = envNum(key, fallback);
  return parsed > 0 ? parsed : fallback;
};

export const envCsv = (fallback: readonly string[], ...keys: string[]): string[] => {
  const value = envFirst(...keys);
  return value === undefined ? [...fallback] : value.split(',').map((part) => part.trim());
};

export function parseEnvValue(value: string): unknown {
  if (isTruthy(value)) return true;
  if (isFalsy(value)) return false;
  const num = Number(value);
  return Number.isNaN(num) ? value : num;
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

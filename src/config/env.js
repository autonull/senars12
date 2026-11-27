/**
 * Standardized `SENARS_*` environment variable → config path mapping.
 * Single source of truth for env-driven configuration overrides.
 * @public
 */
import { toFiniteNumber } from '../util/numeric';
import { setNested } from '../util/object';
export const SENARS_ENV_MAP = {
    SENARS_LM_ENABLED: 'capabilities.lm.enabled',
    SENARS_LM_PROVIDER: 'capabilities.lm.provider',
    SENARS_LM_MODEL: 'capabilities.lm.model',
    SENARS_SENARS_ENABLED: 'capabilities.senars.enabled',
};
const TRUTHY_SPELLINGS = new Set(['true', '1', 'yes', 'on']);
const FALSY_SPELLINGS = new Set(['false', '0', 'no', 'off']);
/** Canonical truthiness for env-sourced strings — every `=== 'true'` check funnels here. */
export const isTruthy = (value) => value !== undefined && TRUTHY_SPELLINGS.has(value.toLowerCase());
/** Exact complement of {@link isTruthy}. The two together are the whole boolean grammar. */
export const isFalsy = (value) => value !== undefined && FALSY_SPELLINGS.has(value.toLowerCase());
/** True only for a spelling both halves accept — the acceptance test a validator wants. */
export const isBooleanSpelling = (value) => isTruthy(value) || isFalsy(value);
/**
 * First defined, non-empty value among `keys`, or `undefined`.
 *
 * **Empty is absent.** A var declared but blank (`LM_API_KEY=` in a CI template,
 * an unset optional in a `.env` many files carry) is the *absence* of a value,
 * and reading it as `''` is what made `Boolean(process.env.KEY)` report a
 * credential that does not exist. The one accessor means one answer.
 */
export const envFirst = (...keys) => {
    for (const key of keys) {
        if (key === undefined)
            continue;
        const value = process.env[key];
        if (value !== undefined && value !== '')
            return value;
    }
    return undefined;
};
/** {@link envFirst} under the name a value read is usually wanted by. */
export const envStr = (...keys) => envFirst(...keys);
/** {@link envStr} with a fallback for the caller that wants a value, not a fact. */
export const envStrOr = (fallback, ...keys) => envFirst(...keys) ?? fallback;
/** True when the key carries a value — the "is it configured?" test. */
export const envSet = (...keys) => envFirst(...keys) !== undefined;
/**
 * The boolean grammar, applied to one key. `LM_OFFLINE=0` is off; a bare
 * `if (process.env.LM_OFFLINE)` would read every non-empty spelling as on.
 */
export const envBool = (key, fallback = false) => {
    const value = envFirst(key);
    return value === undefined ? fallback : isTruthy(value);
};
export const envInt = (key, fallback) => {
    const value = process.env[key];
    if (value === undefined)
        return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
};
/**
 * Finite real number from the first defined alias, or `undefined` when the key is
 * absent, empty, or unparseable. This is the `?? file?.field` shape: a typo'd env
 * value falls through to the file instead of installing `NaN` into typed settings.
 */
export const envNumOr = (...keys) => toFiniteNumber(envFirst(...keys));
/** Finite real number from the environment, else `fallback`. Unlike `envInt`
 *  this keeps fractional values and rejects `NaN`/`Infinity` — the shape caps
 *  and sizes need, where `parseInt` would silently floor `1.5` to `1`. */
export const envNum = (key, fallback) => envNumOr(key) ?? fallback;
/** Positive finite number from the environment, else `fallback` — the guard for
 *  limits and caps, where a non-positive value means "unset", not "zero". */
export const envPositive = (key, fallback) => {
    const parsed = envNum(key, fallback);
    return parsed > 0 ? parsed : fallback;
};
export const envCsv = (fallback, ...keys) => {
    const value = envFirst(...keys);
    return value === undefined ? [...fallback] : value.split(',').map((part) => part.trim());
};
export function parseEnvValue(value) {
    if (isTruthy(value))
        return true;
    if (isFalsy(value))
        return false;
    // `toFiniteNumber`, not `Number()`: `Number('')` is 0 and `Number('Infinity')`
    // is Infinity, so an unset-looking or non-finite value installed a real number
    // into typed settings. This also makes a blank value agree with `envFirst`,
    // which already treats it as absent.
    return toFiniteNumber(value) ?? value;
}
export function readEnvOverrides(env = process.env) {
    const out = {};
    for (const [envKey, configPath] of Object.entries(SENARS_ENV_MAP)) {
        const envValue = env[envKey];
        if (envValue !== undefined) {
            setNested(out, configPath, parseEnvValue(envValue));
        }
    }
    return out;
}

/**
 * Standardized `SENARS_*` environment variable → config path mapping.
 * Single source of truth for env-driven configuration overrides.
 * @public
 */
export declare const SENARS_ENV_MAP: Readonly<Record<string, string>>;
/** Canonical truthiness for env-sourced strings — every `=== 'true'` check funnels here. */
export declare const isTruthy: (value: string | undefined) => boolean;
/** Exact complement of {@link isTruthy}. The two together are the whole boolean grammar. */
export declare const isFalsy: (value: string | undefined) => boolean;
/** True only for a spelling both halves accept — the acceptance test a validator wants. */
export declare const isBooleanSpelling: (value: string | undefined) => boolean;
/**
 * A key the caller may not have. The env name of an API key or a transport is
 * usually *config*, so the lookup is `envStr(settings.apiKeyEnv, 'LM_API_KEY')`
 * — which needs the absent case to be spelled, and spelling it at each call site
 * is what produced `apiKeyEnv ? process.env[apiKeyEnv] : undefined` in six
 * modules, with `undefined` reaching `process.env[undefined]` in the rest.
 */
export type EnvKey = string | undefined;
/**
 * First defined, non-empty value among `keys`, or `undefined`.
 *
 * **Empty is absent.** A var declared but blank (`LM_API_KEY=` in a CI template,
 * an unset optional in a `.env` many files carry) is the *absence* of a value,
 * and reading it as `''` is what made `Boolean(process.env.KEY)` report a
 * credential that does not exist. The one accessor means one answer.
 */
export declare const envFirst: (...keys: readonly EnvKey[]) => string | undefined;
/** {@link envFirst} under the name a value read is usually wanted by. */
export declare const envStr: (...keys: readonly EnvKey[]) => string | undefined;
/** {@link envStr} with a fallback for the caller that wants a value, not a fact. */
export declare const envStrOr: (fallback: string, ...keys: readonly EnvKey[]) => string;
/** True when the key carries a value — the "is it configured?" test. */
export declare const envSet: (...keys: readonly EnvKey[]) => boolean;
/**
 * The boolean grammar, applied to one key. `LM_OFFLINE=0` is off; a bare
 * `if (process.env.LM_OFFLINE)` would read every non-empty spelling as on.
 */
export declare const envBool: (key: EnvKey, fallback?: boolean) => boolean;
export declare const envInt: (key: string, fallback: number) => number;
/**
 * Finite real number from the first defined alias, or `undefined` when the key is
 * absent, empty, or unparseable. This is the `?? file?.field` shape: a typo'd env
 * value falls through to the file instead of installing `NaN` into typed settings.
 */
export declare const envNumOr: (...keys: string[]) => number | undefined;
/** Finite real number from the environment, else `fallback`. Unlike `envInt`
 *  this keeps fractional values and rejects `NaN`/`Infinity` — the shape caps
 *  and sizes need, where `parseInt` would silently floor `1.5` to `1`. */
export declare const envNum: (key: string, fallback: number) => number;
/** Positive finite number from the environment, else `fallback` — the guard for
 *  limits and caps, where a non-positive value means "unset", not "zero". */
export declare const envPositive: (key: string, fallback: number) => number;
export declare const envCsv: (fallback: readonly string[], ...keys: string[]) => string[];
export declare function parseEnvValue(value: string): unknown;
export declare function readEnvOverrides(env?: NodeJS.ProcessEnv): Record<string, unknown>;
//# sourceMappingURL=env.d.ts.map
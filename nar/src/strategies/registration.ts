/**
 * TODO27 §2.1–2.4 — the strategy registration contract.
 *
 * A strategy slot names a strategy *and* its configuration; the registry turns
 * that pair into a validated, memoized instance. A registration is the one
 * declaration of what a strategy is: how to build it, what configuration it
 * accepts, and whether it may hold state across a reconfigure.
 *
 * Leaf module: zod plus types, no imports from the strategy implementations, so
 * `config/` and `cognitive/` can both depend on the contract without joining the
 * strategies→lm→nar SCC.
 */

import { createHash } from 'node:crypto';
import { z, type ZodError } from 'zod';
import { describeStrategyExpression, type StrategyExpression } from '../reason/strategy-algebra.js';
import type { StrategyImpl, StrategyType } from './types.js';

export type { StrategyType };

/** A user-supplied configuration bag; validated by the registration's schema. */
export type StrategyConfig = Readonly<Record<string, unknown>>;

/** The only shape a strategy slot may hold. */
export type StrategySpec = string | CompositeSpec;

/** A composed slot: several names, or the derivation expression algebra. */
export type CompositeSpec = string[] | Exclude<StrategyExpression, string>;

/** Which resolution tier answered a `resolve` call (§2.2). */
export type ResolutionTier = 0 | 1 | 2;

/** The slice of a Zod schema the registry uses: validate, default, and explain. */
export interface ConfigSchema {
  parse(config: unknown): StrategyConfig;
  safeParse(config: unknown): { success: true; data: StrategyConfig } | { success: false; error: ZodError };
}

export interface StrategyRegistration {
  readonly name: string;
  readonly description: string;
  /**
   * True ⇒ exactly one instance exists for the process lifetime and `config` is
   * rejected. State that must survive a `reconfigure` (rule performance, graph
   * edges) belongs in a stateful strategy (Invariant S1).
   */
  readonly stateful: boolean;
  readonly defaultConfig: StrategyConfig;
  /** Validates and defaults a user-supplied config. Stateless strategies only. */
  readonly schema?: ConfigSchema;
  readonly factory: (config: StrategyConfig) => StrategyImpl;
}

/** An object schema narrowed to the registration contract. */
export const configSchema = (shape: z.ZodRawShape): ConfigSchema => {
  // Strict: a key the strategy does not declare is a user error, not a silent no-op.
  const object = z.object(shape).strict();
  return {
    parse: (config) => object.parse(config) as StrategyConfig,
    safeParse: (config) => {
      const result = object.safeParse(config);
      return result.success
        ? { success: true as const, data: result.data as StrategyConfig }
        : { success: false as const, error: result.error };
    },
  };
};

/**
 * Schema + default instance: a stateless strategy whose config is expressible.
 *
 * The builders erase the factory's concrete strategy type to the `StrategyImpl`
 * union — a registration is *the* slot type, and the caller casts at the
 * resolution site where the slot's own interface is known.
 */
export const configurable = (spec: {
  name: string;
  description: string;
  schema: ConfigSchema;
  factory: (config: StrategyConfig) => StrategyImpl;
}): StrategyRegistration => ({
  ...spec,
  stateful: false,
  defaultConfig: spec.schema.parse({}),
});

/** A strategy with nothing to configure: any `config` key is a validation error. */
export const fixed = (spec: {
  name: string;
  description: string;
  factory: (config: StrategyConfig) => StrategyImpl;
}): StrategyRegistration => configurable({ ...spec, schema: configSchema({}) });

/** A pre-built singleton: the instance *is* the registration (Invariant S1). */
export const singleton = (name: string, description: string, instance: StrategyImpl): StrategyRegistration => ({
  name,
  description,
  stateful: true,
  defaultConfig: {},
  factory: () => instance,
});

/** Recursively key-sorted JSON, so `{a,b}` and `{b,a}` are one configuration. */
export const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    // Order is not semantic in a config bag, so equivalent spellings collapse.
    return `[${value.map(canonicalJson).sort().join(',')}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
};

/** `sha256(name || canonicalJson(config))` — the memo key and the telemetry attribute. */
export const configDigest = (name: string, config: StrategyConfig): string =>
  createHash('sha256').update(`${name}\u0000${canonicalJson(config)}`).digest('hex');

export const isStrategyExpression = (spec: StrategySpec | CompositeSpec): spec is Exclude<StrategyExpression, string> =>
  typeof spec === 'object' && !Array.isArray(spec);

/** One line for any spec, for ledgers, logs and error messages. */
export const describeSpec = (spec: StrategySpec): string =>
  typeof spec === 'string'
    ? spec
    : isStrategyExpression(spec)
      ? describeStrategyExpression(spec)
      : spec.join('+');

const unknownName = (slot: string, type: StrategyType, name: string, known: readonly string[]) =>
  `strategies.${slot}.type: no ${type} strategy named '${name}' (available: ${known.join(', ') || 'none'})`;

/**
 * The boundary validation pass (§2.4): every strategy error a user can make is
 * found here, with the candidate list attached, rather than inside
 * `reconfigure` where the stack is four frames deep and the name is lost.
 */
export const strategySpecErrors = (
  slot: string,
  type: StrategyType,
  spec: StrategySpec,
  config: StrategyConfig | undefined,
  registrations: readonly StrategyRegistration[]
): string[] => {
  const byName = new Map(registrations.map((r) => [r.name, r]));
  const known = [...byName.keys()].sort();
  const errors: string[] = [];

  if (config !== undefined && (Array.isArray(spec) || isStrategyExpression(spec))) {
    errors.push(`strategies.${slot}.config: a composed ${type} slot takes no config — configure its parts instead`);
  }

  if (isStrategyExpression(spec)) {
    if (type !== 'derivation') {
      errors.push(
        `strategies.${slot}.type: a strategy expression is a derivation-only form; name a list of ${type} strategies instead`
      );
    }
    return errors;
  }

  const names = Array.isArray(spec) ? spec : [spec];
  if (names.length === 0) errors.push(`strategies.${slot}.type: a composed slot needs at least one strategy name`);

  for (const [index, name] of names.entries()) {
    const registration = byName.get(name);
    if (!registration) {
      errors.push(Array.isArray(spec) ? unknownName(`${slot}[${index}]`, type, name, known) : unknownName(slot, type, name, known));
      continue;
    }
    if (config === undefined) continue;
    if (registration.stateful) {
      errors.push(`strategies.${slot}.config: '${name}' is stateful and accepts no config`);
      continue;
    }
    if (!registration.schema) {
      errors.push(`strategies.${slot}.config: '${name}' declares no configuration schema`);
      continue;
    }
    const parsed = registration.schema.safeParse(config);
    if (!parsed.success) {
      errors.push(`strategies.${slot}.config: ${describeIssues(parsed.error)}`);
    }
  }

  return errors;
};

const describeIssues = (error: ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.length ? issue.path.join('.') : '(root)'} ${issue.message}`)
    .join('; ');

/** Read-only registry surface that validation needs — the registry itself would cycle. */
export interface StrategyCatalog {
  list(type: StrategyType): readonly StrategyRegistration[];
}

/** The strategy system's front door, as consumers depend on it. */
export interface StrategyRegistry {
  /** Register a name + config contract; the implementation is built on demand. */
  register(type: StrategyType, registration: StrategyRegistration): void;

  /** Tier 0: the registered default instance for `name`. */
  get<T>(type: StrategyType, name: string): T;

  /** The read-only slice boundary validation needs — the registry itself would cycle. */
  list(type: StrategyType): StrategyRegistration[];

  has(type: StrategyType, name: string): boolean;

  unregister(type: StrategyType, name: string): boolean;
}

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
import { type ZodError, z } from 'zod';
import { type StrategyExpression } from '../reason/strategy-algebra';
import type { RandomSource } from '../types/primitives';
import type { StrategyImpl, StrategyType } from './types';
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
    safeParse(config: unknown): {
        success: true;
        data: StrategyConfig;
    } | {
        success: false;
        error: ZodError;
    };
}
/**
 * What the registry hands a factory besides its parsed config. A factory that
 * composes *other* strategies needs a way to name them, and the registry is the
 * only thing that can resolve a name.
 */
export interface StrategyFactoryDeps {
    /** Tier 0 resolution by name — the default instance of another registered strategy. */
    resolve<T>(type: StrategyType, name: string): T;
    /**
     * The registry's ambient randomness (TODO27 §16). A stochastic strategy draws
     * from it unless its own config pins a `seed`, so one `rng` on the NAR seeds
     * every strategy that samples.
     */
    rng: RandomSource;
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
    /**
     * Cross-field validation a schema cannot express — "each `models[].name` is a
     * registered attention strategy". Runs at the boundary, before anything is
     * built, and returns human-readable errors.
     */
    readonly validate?: (config: StrategyConfig) => string[];
    readonly factory: (config: StrategyConfig, deps: StrategyFactoryDeps) => StrategyImpl;
}
/** An object schema narrowed to the registration contract. */
export declare const configSchema: (shape: z.ZodRawShape) => ConfigSchema;
/**
 * Schema + default instance: a stateless strategy whose config is expressible.
 *
 * The builders erase the factory's concrete strategy type to the `StrategyImpl`
 * union — a registration is *the* slot type, and the caller casts at the
 * resolution site where the slot's own interface is known.
 */
export declare const configurable: (spec: {
    name: string;
    description: string;
    schema: ConfigSchema;
    validate?: (config: StrategyConfig) => string[];
    factory: (config: StrategyConfig, deps: StrategyFactoryDeps) => StrategyImpl;
}) => StrategyRegistration;
/** A strategy with nothing to configure: any `config` key is a validation error. */
export declare const fixed: (spec: {
    name: string;
    description: string;
    factory: (config: StrategyConfig, deps: StrategyFactoryDeps) => StrategyImpl;
}) => StrategyRegistration;
/**
 * A lazily-built singleton: one instance per registration, built on first
 * resolution and kept for the process lifetime, `config` rejected (Invariant
 * S1). For state that must survive a `reconfigure` — rule performance, graph
 * edges. Lazy so declaring one costs nothing until something asks for it.
 */
export declare const stateful: (spec: {
    name: string;
    description: string;
    factory: () => StrategyImpl;
}) => StrategyRegistration;
/** A pre-built singleton: the instance *is* the registration (Invariant S1). */
export declare const singleton: (name: string, description: string, instance: StrategyImpl) => StrategyRegistration;
/** Recursively key-sorted JSON, so `{a,b}` and `{b,a}` are one configuration. */
export declare const canonicalJson: (value: unknown) => string;
/** Re-export configDigest from canonical location. */
export { configDigest } from '@senars/config/digest';
export declare const isStrategyExpression: (spec: StrategySpec | CompositeSpec) => spec is Exclude<StrategyExpression, string>;
/** One line for any spec, for ledgers, logs and error messages. */
export declare const describeSpec: (spec: StrategySpec) => string;
/**
 * The boundary validation pass (§2.4): every strategy error a user can make is
 * found here, with the candidate list attached, rather than inside
 * `reconfigure` where the stack is four frames deep and the name is lost.
 */
export declare const strategySpecErrors: (slot: string, type: StrategyType, spec: StrategySpec, config: StrategyConfig | undefined, registrations: readonly StrategyRegistration[]) => string[];
/** Read-only registry surface that validation needs — the registry itself would cycle. */
export interface StrategyCatalog {
    list(type: StrategyType): readonly StrategyRegistration[];
}
/** Callback for registration changes. */
export type RegistrationHandler<T> = (registration: T) => void;
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
    /** Subscribe to registration events for a strategy type. */
    onRegister(type: StrategyType, handler: RegistrationHandler<StrategyRegistration>): () => void;
    /** Subscribe to unregistration events for a strategy type. */
    onUnregister(type: StrategyType, handler: (name: string) => void): () => void;
    /** Live reconfigure: update a slot's spec/config and clear relevant memo caches. */
    reconfigure(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): void;
}
//# sourceMappingURL=registration.d.ts.map
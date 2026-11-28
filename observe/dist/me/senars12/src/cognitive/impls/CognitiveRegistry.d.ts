/**
 * The strategy registry — the one place a strategy is named, configured,
 * validated, built, memoized and observed.
 *
 * Three resolution tiers (§2.2 of TODO27):
 *  - **0** a bare name ⇒ the registered default instance, reference-identical
 *  - **1** a bare name plus config ⇒ schema-validated, built once per digest
 *  - **2** a list or expression ⇒ composed, registered under a stable label
 *
 * Nothing else in the system constructs or selects a strategy.
 */
import type { RandomSource } from '../../types/primitives';
import { type StrategyConfig, type StrategyRegistration, type StrategySpec, type RegistrationHandler } from '../../strategies/registration';
import type { StrategyImpl, StrategyType } from '../../strategies/types';
import type { StrategyRegistry } from '../../strategies/registration';
import type { CognitiveParameters } from '../../config/cognitive-parameters';
/**
 * Resolve one slot of a parameter graph to its instance. The single read path
 * for a slot outside the controller — a replaying or headless caller that holds
 * a registry and a graph but no `CognitiveController` must not open a second
 * spelling of what the controller already does.
 */
export declare const resolveSlot: <T>(registry: CognitiveRegistry, params: CognitiveParameters, type: StrategyType) => T;
/**
 * A registry with every built-in registration loaded.
 *
 * The registry has no external dependencies, so a NAR always has one — there is
 * no "bare NAR" whose strategy slots are quietly hardcoded. Callers that want a
 * custom catalogue still pass their own; this is the default, not a global.
 */
export declare const createDefaultRegistry: ({ rng }?: {
    rng?: RandomSource;
}) => CognitiveRegistry;
export declare class CognitiveRegistry implements StrategyRegistry {
    #private;
    private readonly stores;
    /** Tier 0: the registered default instance per name. */
    private readonly defaults;
    /** Tier 1: configured instances keyed by config digest. */
    private readonly configured;
    /** Tier 2: composed instances keyed by their deterministic label. */
    private readonly composed;
    /** Registrations mid-build, so a self-referential composite is an error, not a stack overflow. */
    private readonly building;
    /** Ambient randomness handed to every factory (TODO27 §16). */
    private readonly rng;
    /** Event handlers for registration changes. */
    private readonly registerHandlers;
    private readonly unregisterHandlers;
    constructor({ rng }?: {
        rng?: RandomSource;
    });
    register(type: StrategyType, registration: StrategyRegistration): void;
    /** @deprecated pass a `StrategyRegistration` — a bare instance cannot carry its config contract. */
    register(type: StrategyType, name: string, impl: StrategyImpl): void;
    /** Subscribe to registration events for a strategy type. */
    onRegister(type: StrategyType, handler: RegistrationHandler<StrategyRegistration>): () => void;
    /** Subscribe to unregistration events for a strategy type. */
    onUnregister(type: StrategyType, handler: (name: string) => void): () => void;
    /** Tier 0: the registered default instance for `name`. */
    get<T>(type: StrategyType, name: string): T;
    /**
     * The one resolution path. `config` is required for Tier 1, and rejected on a
     * stateful strategy (Invariant S1) rather than silently ignored.
     */
    resolve<T>(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): T;
    list(type: StrategyType): StrategyRegistration[];
    has(type: StrategyType, name: string): boolean;
    unregister(type: StrategyType, name: string): boolean;
    /** Total memoized (tier 1 + tier 2) instances held for a slot — bounded, not a leak. */
    memoizedSize(type: StrategyType): number;
    clear(type?: StrategyType): void;
    initializeDefaults(): void;
    /** Validate a slot without building anything — the boundary check (§2.4). */
    validate(type: StrategyType, spec: StrategySpec, config?: StrategyConfig, slot?: string): void;
    /** Live reconfigure: update a slot's spec/config and clear relevant memo caches. */
    reconfigure(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): void;
}
//# sourceMappingURL=CognitiveRegistry.d.ts.map
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

import { ConfigurationError } from '../types';
import { emitStrategySelection } from '../tick';
import {
  configDigest,
  strategySpecErrors,
  type CompositeSpec,
  type ResolutionTier,
  type StrategyConfig,
  type StrategyRegistration,
  type StrategySpec,
} from '../strategies/registration';
import type { StrategyImpl, StrategyType } from '../strategies/types.js';
import type { StrategyRegistry } from '../strategies/registration.js';
import { DEFAULT_REGISTRATIONS } from './registrations.js';
import { composedName, composeSpec } from './composition.js';

type Slot = Map<string, StrategyRegistration>;
type InstanceCache = Map<string, StrategyImpl>;

const SLOT_TYPES = ['sampling', 'premise', 'derivation', 'lm-rule', 'attention'] as const;

const emptyStores = <V>(): Record<StrategyType, Map<string, V>> =>
  Object.fromEntries(SLOT_TYPES.map((type) => [type, new Map<string, V>()])) as Record<
    StrategyType,
    Map<string, V>
  >;

export class CognitiveRegistry implements StrategyRegistry {
  private readonly stores: Record<StrategyType, Slot> = emptyStores();
  /** Tier 0: the registered default instance per name. */
  private readonly defaults: Record<StrategyType, InstanceCache> = emptyStores();
  /** Tier 1: configured instances keyed by config digest. */
  private readonly configured: Record<StrategyType, InstanceCache> = emptyStores();
  /** Tier 2: composed instances keyed by their deterministic label. */
  private readonly composed: Record<StrategyType, InstanceCache> = emptyStores();

  register(type: StrategyType, registration: StrategyRegistration): void;
  /** @deprecated pass a `StrategyRegistration` — a bare instance cannot carry its config contract. */
  register(type: StrategyType, name: string, impl: StrategyImpl): void;
  register(
    type: StrategyType,
    nameOrRegistration: string | StrategyRegistration,
    impl?: StrategyImpl
  ): void {
    const registration =
      typeof nameOrRegistration === 'string'
        ? ({
            name: nameOrRegistration,
            description: impl?.metadata?.description ?? nameOrRegistration,
            stateful: true,
            defaultConfig: {},
            factory: () => impl!,
          } satisfies StrategyRegistration)
        : nameOrRegistration;

    if (this.stores[type].has(registration.name)) {
      throw new ConfigurationError(`'${registration.name}' already registered for ${type}`, {
        type,
        name: registration.name,
      });
    }
    this.stores[type].set(registration.name, registration);
  }

  /** Tier 0: the registered default instance for `name`. */
  get<T>(type: StrategyType, name: string): T {
    const impl = this.defaults[type].get(name) ?? this.#buildDefault(type, name);
    this.#emit(type, name, 0);
    return impl as unknown as T;
  }

  /**
   * The one resolution path. `config` is required for Tier 1, and rejected on a
   * stateful strategy (Invariant S1) rather than silently ignored.
   */
  resolve<T>(type: StrategyType, spec: StrategySpec, config?: StrategyConfig): T {
    if (typeof spec === 'string') {
      return config === undefined ? this.get<T>(type, spec) : this.#configured<T>(type, spec, config);
    }
    return this.#composed<T>(type, spec, config);
  }

  list(type: StrategyType): StrategyRegistration[] {
    return [...this.stores[type].values()];
  }

  has(type: StrategyType, name: string): boolean {
    return this.stores[type].has(name);
  }

  unregister(type: StrategyType, name: string): boolean {
    this.defaults[type].delete(name);
    this.configured[type].delete(name);
    return this.stores[type].delete(name);
  }

  clear(type?: StrategyType): void {
    const types = type ? [type] : (Object.keys(this.stores) as StrategyType[]);
    for (const t of types) {
      this.stores[t].clear();
      this.defaults[t].clear();
      this.configured[t].clear();
      this.composed[t].clear();
    }
  }

  initializeDefaults(): void {
    for (const [type, registration] of DEFAULT_REGISTRATIONS) this.register(type, registration);
  }

  /** Validate a slot without building anything — the boundary check (§2.4). */
  validate(type: StrategyType, spec: StrategySpec, config?: StrategyConfig, slot: string = type): void {
    const errors = strategySpecErrors(slot, type, spec, config, this.list(type));
    if (errors.length) throw new ConfigurationError(errors.join('; '), { type, errors });
  }

  #buildDefault(type: StrategyType, name: string): StrategyImpl {
    const registration = this.stores[type].get(name);
    if (!registration) {
      const candidates = [...this.stores[type].keys()].sort();
      throw new ConfigurationError(
        `No ${type} strategy named '${name}' (available: ${candidates.join(', ') || 'none'})`,
        { type, name }
      );
    }
    const impl = registration.factory(registration.defaultConfig);
    this.defaults[type].set(name, impl);
    return impl;
  }

  #configured<T>(type: StrategyType, name: string, config: StrategyConfig): T {
    const registration = this.stores[type].get(name);
    if (!registration) this.#buildDefault(type, name); // throws with the candidate list
    this.validate(type, name, config);
    const { schema, factory } = registration!;
    const parsed = schema!.parse(config);
    const digest = configDigest(name, parsed);
    const cache = this.configured[type];
    const existing = cache.get(digest);
    if (existing) return existing as T;

    const impl = factory(parsed);
    cache.set(digest, impl);
    this.#emit(type, name, 1, digest);
    return impl as T;
  }

  #composed<T>(type: StrategyType, spec: CompositeSpec, config?: StrategyConfig): T {
    this.validate(type, spec, config);
    const label = composedName(spec);
    const cache = this.composed[type];
    const existing = cache.get(label);
    if (existing) return existing as T;

    const impl = composeSpec<StrategyImpl>(type, spec, (name) => this.get(type, name));
    const resolved = impl as T;
    cache.set(label, impl);
    this.#emit(type, label, 2);
    return resolved;
  }

  #emit(type: StrategyType, name: string, tier: ResolutionTier, digest?: string): void {
    emitStrategySelection({
      strategyType: type,
      strategyName: name,
      configDigest: digest,
      context: { tier },
    });
  }
}

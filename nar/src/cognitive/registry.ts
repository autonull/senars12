import {
  AdaptiveStrategy,
  AnalogicalStrategy,
  BagStrategy,
  CompositeStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  ExhaustiveStrategy,
  GoalDrivenStrategy,
  ResolutionStrategy,
  SampledStrategy,
  SemanticStrategy,
  TermLinkStrategy,
  PrologResolutionStrategy,
} from '../strategies/premise';
import type {
  AttentionModel,
  ComponentMetadata,
  DerivationStrategy,
  LMRuleSelector,
  SamplingStrategy,
  Strategy,
  StrategyImpl,
  StrategyRegistry,
  StrategyType,
} from '../strategies/types.js';
import {
  AllSelector,
  AnytimeDerivation,
  CompositeAttention,
  DefaultDerivation,
  DiverseSampling,
  DiverseSelector,
  FocusedDerivation,
  GoalBiasedSampling,
  GoalRelevanceAttention,
  NoveltySampling,
  PrioritySampling,
  PrioritySelector,
  RotationSelector,
  SampledDerivation,
  SimpleAttention,
  SpreadingActivation,
  TopNSampling,
  WindowedRouletteStrategy,
} from '../strategies';
import { ConfigurationError } from '../types';
import { PriorityBag } from '../bag/Bag';
import { emitStrategySelection } from '../tick';

type StrategyMap = Map<string, StrategyImpl>;

interface StrategyItem<T> {
  id: string;
  priority: number;
  strategy: T;
}

function createCompositeBag<T>(items: StrategyItem<T>[]): PriorityBag<StrategyItem<T>> {
  const bag = new PriorityBag<StrategyItem<T>>({ capacity: items.length });
  for (const item of items) bag.add(item);
  return bag;
}

/**
 * Generic bag-weighted composite for any strategy interface.
 * Replaces CompositeSampling, CompositeLMRuleSelector, CompositeAttentionModel, CompositeDerivationStrategy.
 */
class BagComposite<T extends { metadata?: ComponentMetadata }> {
  readonly metadata: ComponentMetadata = { name: 'bag-composite', description: 'Bag-weighted composite strategy' };
  readonly name = 'bag-composite';
  private readonly bag: PriorityBag<StrategyItem<T>>;
  private readonly invoke: (strategy: T, ...args: unknown[]) => unknown;

  constructor(
    strategies: T[],
    weights: number[],
    invoke: (strategy: T, ...args: unknown[]) => unknown
  ) {
    this.bag = createCompositeBag(
      strategies.map((s, i) => ({
        id: s.metadata?.name ?? `strategy-${i}`,
        priority: weights[i] ?? 1,
        strategy: s,
      }))
    );
    this.invoke = invoke;
  }

  call(...args: unknown[]): unknown {
    const item = this.bag.sample();
    return item ? this.invoke(item.strategy, ...args) : undefined;
  }
}

export class CognitiveRegistry implements StrategyRegistry {
  private readonly stores: Record<StrategyType, StrategyMap> = {
    sampling: new Map(),
    premise: new Map(),
    derivation: new Map(),
    'lm-rule': new Map(),
    attention: new Map(),
  };

  register(type: StrategyType, name: string, impl: StrategyImpl): void {
    if (this.stores[type].has(name)) {
      throw new ConfigurationError(`'${name}' already registered for ${type}`, { type, name });
    }
    this.stores[type].set(name, impl);
  }

  get<T>(type: StrategyType, name: string): T {
    const impl = this.stores[type].get(name);
    if (!impl) {
      throw new ConfigurationError(`No ${type} strategy named '${name}'`, { type, name });
    }
    emitStrategySelection({
      strategyType: type,
      strategyName: name,
    });
    return impl as unknown as T;
  }

  list(type: StrategyType): ComponentMetadata[] {
    const result: ComponentMetadata[] = [];
    for (const s of this.stores[type].values()) {
      const m = (s as { metadata?: ComponentMetadata }).metadata;
      if (m) result.push(m);
    }
    return result;
  }

  has(type: StrategyType, name: string): boolean {
    return this.stores[type].has(name);
  }

  unregister(type: StrategyType, name: string): boolean {
    return this.stores[type].delete(name);
  }

  clear(type?: StrategyType): void {
    if (type) this.stores[type].clear();
    else for (const s of Object.values(this.stores)) s.clear();
  }

  initializeDefaults(): void {
    type Registration = [StrategyType, string, StrategyImpl];
    const items: Registration[] = [
      ['sampling', 'priority', new PrioritySampling()],
      ['sampling', 'top-n', new TopNSampling()],
      ['sampling', 'novelty', new NoveltySampling()],
      ['sampling', 'goal-biased', new GoalBiasedSampling()],
      ['sampling', 'diverse', new DiverseSampling()],
      ['sampling', 'windowed-roulette', new WindowedRouletteStrategy()],
      ['premise', 'default-formation', DefaultFormationStrategy],
      ['premise', 'bag', BagStrategy],
      ['premise', 'resolution', ResolutionStrategy],
      ['premise', 'goal-driven', GoalDrivenStrategy],
      ['premise', 'analogical', AnalogicalStrategy],
      ['premise', 'term-link', TermLinkStrategy],
      ['premise', 'sampled', SampledStrategy],
      ['premise', 'decomposition', DecompositionStrategy],
      ['premise', 'exhaustive', ExhaustiveStrategy],
      ['premise', 'semantic', SemanticStrategy],
      ['premise', 'prolog-resolution', new PrologResolutionStrategy()],
      ['derivation', 'default', new DefaultDerivation()],
      ['derivation', 'anytime', new AnytimeDerivation()],
      ['derivation', 'focused', new FocusedDerivation()],
      ['derivation', 'sampled', new SampledDerivation()],
      ['lm-rule', 'all', new AllSelector()],
      ['lm-rule', 'priority', new PrioritySelector()],
      ['lm-rule', 'rotation', new RotationSelector()],
      ['lm-rule', 'diverse', new DiverseSelector()],
      ['attention', 'simple', new SimpleAttention()],
      ['attention', 'spreading', new SpreadingActivation()],
      ['attention', 'goal-relevance', new GoalRelevanceAttention()],
      ['attention', 'composite', new CompositeAttention([])],
    ];
    for (const [type, name, impl] of items) this.register(type, name, impl);
  }

  composePremise(names: Array<{ name: string; weight: number }>): Strategy {
    return this.compose('premise', names);
  }

  compose<T extends StrategyImpl>(type: StrategyType, names: Array<{ name: string; weight: number }>): T {
    const strategies = names.map((n) => this.get<T>(type, n.name));
    const weights = names.map((n) => n.weight);

    const invoke = (strategy: T, ...args: unknown[]): unknown => {
      switch (type) {
        case 'sampling': {
          const memory = args[0] as any;
          const count = args[1] as number;
          return (strategy as SamplingStrategy).sample(memory, count);
        }
        case 'premise': {
          const task = args[0] as any;
          const memory = args[1] as any;
          return (strategy as Strategy).selectSecondary(task, memory);
        }
        case 'derivation': {
          const primary = args[0] as any;
          const secondaries = args[1] as any;
          const processor = args[2] as any;
          const context = args[3] as any;
          return (async function* () {
            yield* (strategy as DerivationStrategy).derive(primary, secondaries, processor, context);
          })();
        }
        case 'lm-rule': {
          const rules = args[0] as any;
          const context = args[1] as any;
          return (strategy as LMRuleSelector).select(rules, context);
        }
        case 'attention': {
          const method = args[0] as string;
          const attention = strategy as AttentionModel;
          const concept = args[1] as any;
          const context = args[2] as any;
          const cyclesOrRate = args[3] as any;
          switch (method) {
            case 'prime': return attention.prime(concept, context);
            case 'decay': return attention.decay(concept, cyclesOrRate as number, context as number);
            case 'tick': return attention.tick(concept, cyclesOrRate as number);
          }
        }
      }
    };

    const composite = new BagComposite(strategies, weights, invoke);
    return composite as unknown as T;
  }

  createAdaptive(names: string[]): Strategy {
    return new AdaptiveStrategy(names.map((n) => this.get<Strategy>('premise', n)));
  }
}
import {
  AdaptiveStrategy,
  AnalogicalStrategy,
  BagStrategy,
  CompositeStrategy,
  DecompositionStrategy,
  DefaultFormationStrategy,
  ExhaustiveStrategy,
  GoalDrivenStrategy,
  PrologStrategy,
  ResolutionStrategy,
  TaskMatchStrategy,
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
  StrategyRegistry,
  StrategyType,
} from '../strategies';
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
} from '../strategies';
import { ConfigurationError } from '../types';
import { PriorityBag } from '../bag/Bag';

type StrategyImpl =
  | SamplingStrategy
  | Strategy
  | DerivationStrategy
  | LMRuleSelector
  | AttentionModel;
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

/** Composite SamplingStrategy using bag sampling. */
class CompositeSampling implements SamplingStrategy {
  readonly metadata: ComponentMetadata = { name: 'composite-sampling', description: 'Bag-weighted composite sampling' };
  readonly name = 'composite-sampling';
  private readonly bag: PriorityBag<StrategyItem<SamplingStrategy>>;

  constructor(strategies: SamplingStrategy[], weights: number[]) {
    this.bag = createCompositeBag(
      strategies.map((s, i) => ({ id: s.metadata?.name ?? `sampling-${i}`, priority: weights[i] ?? 1, strategy: s }))
    );
  }

  sample(memory: any, count: number): any[] {
    const item = this.bag.sample();
    return item?.strategy.sample(memory, count) ?? [];
  }
}

/** Composite LMRuleSelector using bag sampling. */
class CompositeLMRuleSelector implements LMRuleSelector {
  readonly metadata: ComponentMetadata = { name: 'composite-lm-rule', description: 'Bag-weighted composite LM rule selector' };
  readonly name = 'composite-lm-rule';
  private readonly bag: PriorityBag<StrategyItem<LMRuleSelector>>;

  constructor(strategies: LMRuleSelector[], weights: number[]) {
    this.bag = createCompositeBag(
      strategies.map((s, i) => ({ id: s.metadata?.name ?? `lm-rule-${i}`, priority: weights[i] ?? 1, strategy: s }))
    );
  }

  select(rules: any[], context: any): any[] {
    const item = this.bag.sample();
    return item?.strategy.select(rules, context) ?? [];
  }
}

/** Composite AttentionModel using bag sampling. */
class CompositeAttentionModel implements AttentionModel {
  readonly metadata: ComponentMetadata = { name: 'composite-attention', description: 'Bag-weighted composite attention model' };
  readonly name = 'composite-attention';
  private readonly bag: PriorityBag<StrategyItem<AttentionModel>>;

  constructor(strategies: AttentionModel[], weights: number[]) {
    this.bag = createCompositeBag(
      strategies.map((s, i) => ({ id: s.metadata?.name ?? `attention-${i}`, priority: weights[i] ?? 1, strategy: s }))
    );
  }

  prime(concept: any, context: any): number {
    const item = this.bag.sample();
    return item?.strategy.prime(concept, context) ?? 0;
  }
  decay(concept: any, cyclesElapsed: number, baseDecayRate: number): number {
    const item = this.bag.sample();
    return item?.strategy.decay(concept, cyclesElapsed, baseDecayRate) ?? baseDecayRate;
  }
  tick(memory: any, cycleCount: number): void {
    const item = this.bag.sample();
    item?.strategy.tick(memory, cycleCount);
  }
}

/** Composite DerivationStrategy using bag sampling. */
class CompositeDerivationStrategy implements DerivationStrategy {
  readonly metadata: ComponentMetadata = { name: 'composite-derivation', description: 'Bag-weighted composite derivation strategy' };
  readonly name = 'composite-derivation';
  private readonly bag: PriorityBag<StrategyItem<DerivationStrategy>>;

  constructor(strategies: DerivationStrategy[], weights: number[]) {
    this.bag = createCompositeBag(
      strategies.map((s, i) => ({ id: s.metadata?.name ?? `derivation-${i}`, priority: weights[i] ?? 1, strategy: s }))
    );
  }

  async *derive(primary: any, secondaries: any[], processor: any, context: any): AsyncGenerator<any> {
    const item = this.bag.sample();
    if (item) yield* item.strategy.derive(primary, secondaries, processor, context);
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
      ['premise', 'default-formation', DefaultFormationStrategy],
      ['premise', 'bag', BagStrategy],
      ['premise', 'prolog', PrologStrategy],
      ['premise', 'resolution', ResolutionStrategy],
      ['premise', 'goal-driven', GoalDrivenStrategy],
      ['premise', 'analogical', AnalogicalStrategy],
      ['premise', 'term-link', TermLinkStrategy],
      ['premise', 'task-match', TaskMatchStrategy],
      ['premise', 'decomposition', DecompositionStrategy],
      ['premise', 'exhaustive', ExhaustiveStrategy],
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

    switch (type) {
      case 'sampling':
        return new CompositeSampling(strategies as SamplingStrategy[], weights) as unknown as T;
      case 'premise':
        return new CompositeStrategy(
          strategies as Strategy[],
          'weighted',
          weights
        ) as unknown as T;
      case 'derivation':
        return new CompositeDerivationStrategy(strategies as DerivationStrategy[], weights) as unknown as T;
      case 'lm-rule':
        return new CompositeLMRuleSelector(strategies as LMRuleSelector[], weights) as unknown as T;
      case 'attention':
        return new CompositeAttentionModel(strategies as AttentionModel[], weights) as unknown as T;
      default:
        throw new ConfigurationError(`Unknown strategy type: ${type}`);
    }
  }

  createAdaptive(names: string[]): Strategy {
    return new AdaptiveStrategy(names.map((n) => this.get<Strategy>('premise', n)));
  }
}
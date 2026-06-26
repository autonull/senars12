import type {SamplingStrategy, Strategy, DerivationStrategy, LMRuleSelector, AttentionModel, StrategyRegistry, StrategyType, ComponentMetadata} from '../strategies/types.js';
import {ConfigurationError} from '../types/core.js';
import {PrioritySampling, TopNSampling, NoveltySampling, GoalBiasedSampling, DiverseSampling} from '../strategies/sampling/index.js';
import {DefaultDerivation, AnytimeDerivation, FocusedDerivation, SampledDerivation} from '../strategies/derivation/index.js';
import {AllSelector, PrioritySelector, RotationSelector, DiverseSelector} from '../strategies/lm-selectors/index.js';
import {SimpleAttention, SpreadingActivation, GoalRelevanceAttention, CompositeAttention} from '../strategies/attention/index.js';
import {BagStrategy, ExhaustiveStrategy} from '../reason/strategy';
import {
  PrologStrategy, ResolutionStrategy, GoalDrivenStrategy, AnalogicalStrategy,
  TermLinkStrategy, TaskMatchStrategy, DecompositionStrategy, DefaultFormationStrategy,
  CompositeStrategy, AdaptiveStrategy
} from '../reason/strategies';

type StrategyImpl = SamplingStrategy | Strategy | DerivationStrategy | LMRuleSelector | AttentionModel;
type StrategyMap = Map<string, StrategyImpl>;

export class CognitiveRegistry implements StrategyRegistry {
  private readonly stores: Record<StrategyType, StrategyMap> = {
    sampling:   new Map(),
    premise:    new Map(),
    derivation: new Map(),
    'lm-rule':  new Map(),
    attention:  new Map(),
  };

  register(type: StrategyType, name: string, impl: StrategyImpl): void {
    if (this.stores[type].has(name)) {
      throw new ConfigurationError(
        `'${name}' already registered for ${type}`,
        {type, name}
      );
    }
    this.stores[type].set(name, impl);
  }

  get<T>(type: StrategyType, name: string): T {
    const impl = this.stores[type].get(name);
    if (!impl) {
      throw new ConfigurationError(
        `No ${type} strategy named '${name}'`,
        {type, name}
      );
    }
    return impl as T;
  }

  list(type: StrategyType): ComponentMetadata[] {
    const result: ComponentMetadata[] = [];
    for (const s of this.stores[type].values()) {
      const m = (s as {metadata?: ComponentMetadata}).metadata;
      if (m) result.push(m);
    }
    return result;
  }

  has(type: StrategyType, name: string): boolean { return this.stores[type].has(name); }
  unregister(type: StrategyType, name: string): boolean { return this.stores[type].delete(name); }

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
    const strategies = names.map(n => this.get<Strategy>('premise', n.name));
    return new CompositeStrategy(strategies, 'weighted', names.map(n => n.weight));
  }

  createAdaptive(names: string[]): Strategy {
    return new AdaptiveStrategy(names.map(n => this.get<Strategy>('premise', n)));
  }
}

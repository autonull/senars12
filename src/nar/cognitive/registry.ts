import type {SamplingStrategy, Strategy, DerivationStrategy, LMRuleSelector, AttentionModel, StrategyRegistry, StrategyType, ComponentMetadata} from '../strategies/types.js';
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

export class CognitiveRegistry implements StrategyRegistry {
  private stores = {
    sampling:   new Map<string, SamplingStrategy>(),
    premise:    new Map<string, Strategy>(),
    derivation: new Map<string, DerivationStrategy>(),
    'lm-rule':  new Map<string, LMRuleSelector>(),
    attention:  new Map<string, AttentionModel>(),
  };

  register(type: StrategyType, name: string, impl: any): void {
    if (this.stores[type].has(name)) throw new Error(`'${name}' already registered for ${type}`);
    this.stores[type].set(name, impl);
  }

  get<T>(type: StrategyType, name: string): T {
    const impl = this.stores[type].get(name);
    if (!impl) throw new Error(`No ${type} strategy named '${name}'`);
    return impl as T;
  }

  list(type: StrategyType): ComponentMetadata[] {
    return [...this.stores[type].values()].map(s => (s as {metadata?: ComponentMetadata}).metadata).filter(Boolean) as ComponentMetadata[];
  }

  has(type: StrategyType, name: string): boolean { return this.stores[type].has(name); }
  unregister(type: StrategyType, name: string): boolean { return this.stores[type].delete(name); }

  clear(type?: StrategyType): void {
    if (type) this.stores[type].clear();
    else for (const s of Object.values(this.stores)) (s as Map<string, unknown>).clear();
  }

  initializeDefaults(): void {
    this.register('sampling', 'priority', new PrioritySampling());
    this.register('sampling', 'top-n', new TopNSampling());
    this.register('sampling', 'novelty', new NoveltySampling());
    this.register('sampling', 'goal-biased', new GoalBiasedSampling());
    this.register('sampling', 'diverse', new DiverseSampling());

    this.register('premise', 'default-formation', DefaultFormationStrategy);
    this.register('premise', 'bag', BagStrategy);
    this.register('premise', 'prolog', PrologStrategy);
    this.register('premise', 'resolution', ResolutionStrategy);
    this.register('premise', 'goal-driven', GoalDrivenStrategy);
    this.register('premise', 'analogical', AnalogicalStrategy);
    this.register('premise', 'term-link', TermLinkStrategy);
    this.register('premise', 'task-match', TaskMatchStrategy);
    this.register('premise', 'decomposition', DecompositionStrategy);
    this.register('premise', 'exhaustive', ExhaustiveStrategy);

    this.register('derivation', 'default', new DefaultDerivation());
    this.register('derivation', 'anytime', new AnytimeDerivation());
    this.register('derivation', 'focused', new FocusedDerivation());
    this.register('derivation', 'sampled', new SampledDerivation());

    this.register('lm-rule', 'all', new AllSelector());
    this.register('lm-rule', 'priority', new PrioritySelector());
    this.register('lm-rule', 'rotation', new RotationSelector());
    this.register('lm-rule', 'diverse', new DiverseSelector());

    this.register('attention', 'simple', new SimpleAttention());
    this.register('attention', 'spreading', new SpreadingActivation());
    this.register('attention', 'goal-relevance', new GoalRelevanceAttention());
    this.register('attention', 'composite', new CompositeAttention([]));
  }

  composePremise(names: Array<{ name: string; weight: number }>): Strategy {
    const strategies = names.map(n => this.get<Strategy>('premise', n.name));
    return new CompositeStrategy(strategies, 'weighted', names.map(n => n.weight));
  }

  createAdaptive(names: string[]): Strategy {
    return new AdaptiveStrategy(names.map(n => this.get<Strategy>('premise', n)));
  }
}

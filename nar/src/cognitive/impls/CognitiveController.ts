import { removeBy } from '@senars/util';
import {
  type CognitiveParameters,
  type StrategySlotParams,
  sameStrategies,
} from '../../config/cognitive-parameters';
import type { ControlBudgetPort } from '../../kernel/control-budgets.js';
import type { MemoryPorts } from '../../memory/ports/index.js';
import type { MetricsCollector } from '../../metrics';
import type { Strategy } from '../../reason';
import { InferenceController } from '../../reason/inference-controller';
import type { RLFPLearner } from '../../rlfp';
import type { RuleProcessor } from '../../rules';
import type { DerivationStrategy, ModelRuleSelector, SamplingStrategy } from '../../strategies';
import type { RuleGraph } from '../../strategies/lm-graph/RuleGraph.js';
import type { StrategySpec, StrategyType } from '../../strategies/registration';
import type { AttentionModel } from '../../strategies/types.js';
import type { Task } from '../../types';
import type { CognitiveRegistry } from './CognitiveRegistry.js';
import { SLOT_KEY } from './CognitiveRegistry.js';

export class CognitiveController {
  private currentParams: CognitiveParameters;
  private readonly inferenceController: InferenceController;
  /** TODO29.a §5.7: the declared control budgets, injected once and never rebuilt. */
  private readonly budgets?: ControlBudgetPort;
  private cycleCount = 0;
  private readonly adaptInterval: number;
  private readonly onAdaptCallbacks: Array<() => void> = [];
  private readonly onDerivationCallbacks: Array<(chain: readonly Task[]) => void> = [];

  constructor(
    private readonly registry: CognitiveRegistry,
    private readonly memory: MemoryPorts,
    private readonly processor: RuleProcessor,
    private readonly metrics: MetricsCollector,
    private readonly rlfp: RLFPLearner | undefined,
    params: CognitiveParameters,
    adaptInterval = 50,
    budgets?: ControlBudgetPort
  ) {
    this.budgets = budgets;
    // Own the parameter graph: callers may pass frozen defaults (TODO20 C3).
    this.currentParams = structuredClone(params);
    this.adaptInterval = adaptInterval;
    this.validateSlots(params);
    this.inferenceController = this.buildInferenceController(params);
  }

  /** Every slot is checked before any strategy is built (TODO27 §2.4). */
  private validateSlots(params: CognitiveParameters): void {
    for (const [type, key] of Object.entries(SLOT_KEY) as Array<
      [StrategyType, (typeof SLOT_KEY)[StrategyType]]
    >) {
      const slot = params.strategies[key] as StrategySlotParams;
      this.registry.validate(type, slot.type, slot.config, key);
    }
  }

  getInferenceController(): InferenceController {
    return this.inferenceController;
  }

  /**
   * Replace the whole parameter graph in place. Validation happens before any
   * strategy is built, so a bad slot leaves the live controller untouched; the
   * resolved strategies then reconfigure the same `InferenceController` every
   * other holder already has a reference to.
   */
  reconfigure(params: CognitiveParameters): void {
    this.validateSlots(params);
    this.currentParams = structuredClone(params);
    this.buildInferenceController(this.currentParams);
  }

  /** The live parameter graph. */
  getParams(): Readonly<CognitiveParameters> {
    return this.currentParams;
  }

  getRegistry(): CognitiveRegistry {
    return this.registry;
  }

  /** Register a callback to be called on each adapt cycle */
  onAdapt(fn: () => void): () => void {
    this.onAdaptCallbacks.push(fn);
    return () => {
      removeBy(this.onAdaptCallbacks, (callback) => callback === fn);
    };
  }

  /** Register a callback to be called on each derivation chain */
  onDerivation(fn: (chain: readonly Task[]) => void): () => void {
    this.onDerivationCallbacks.push(fn);
    return () => {
      removeBy(this.onDerivationCallbacks, (callback) => callback === fn);
    };
  }

  /** Get the current spec for a strategy type; a composed slot has several names. */
  getStrategy(type: StrategyType): StrategySpec | undefined {
    return this.currentParams.strategies[SLOT_KEY[type]]?.type;
  }

  adapt(): void {
    this.cycleCount++;
    if (this.cycleCount % this.adaptInterval !== 0 || !this.rlfp) {
      // Still fire onAdapt callbacks even if RLFP doesn't run
      for (const cb of this.onAdaptCallbacks) cb();
      return;
    }

    const newParams = this.adaptWithRLFP();
    if (!sameStrategies(newParams.strategies, this.currentParams.strategies)) {
      this.currentParams = newParams;
      this.buildInferenceController(newParams);
    }

    // Fire onAdapt callbacks after potential reconfiguration
    for (const cb of this.onAdaptCallbacks) cb();
  }

  /**
   * Name the strategy (and its configuration) for a slot. A bare name, a list
   * of names, or a derivation expression — the slot's own resolution is the
   * only place any of them is interpreted.
   */
  setStrategy(type: StrategyType, spec: StrategySpec, config?: Record<string, unknown>): void {
    this.registry.validate(type, spec, config, SLOT_KEY[type]);
    const slot = this.currentParams.strategies[SLOT_KEY[type]] as StrategySlotParams;
    slot.type = spec;
    if (config) slot.config = config;
    else delete slot.config;
    this.buildInferenceController(this.currentParams);
  }

  private buildInferenceController(params: CognitiveParameters): InferenceController {
    const sampling = this.resolve<SamplingStrategy>('sampling', params);
    const strategy = this.resolve<Strategy>('premise', params);
    const derivationStrategy = this.resolve<DerivationStrategy>('derivation', params);
    const lmRule = this.resolveLMRule(params);

    // `attention` is a slot like the other four, so it resolves here and is
    // installed on the live memory. Resolving it anywhere else leaves memory
    // holding the model built at construction while the parameter graph claims a
    // different one — a reconfigure that validates, stores, and does nothing.
    this.memory.setAttentionModel(this.resolve<AttentionModel>('attention', params));

    this.processor.setModelRuleSelector(lmRule.selector, params.strategies.lmRule.maxRules);
    if (lmRule.ruleGraph) this.#wireRuleGraphCallbacks(lmRule.ruleGraph);

    const inferenceConfig = {
      maxDerivationsPerStep: params.inference.maxDerivationsPerStep,
      maxDerivationDepth: params.inference.maxDerivationDepth,
      enableCircularDetection: params.inference.enableCircularDetection ?? true,
      cpuThrottleMs: params.inference.cpuThrottleMs ?? 0,
      singlePremiseLMRules: params.lm.singlePremiseEnabled ?? true,
      sampleSize: params.inference.maxSampledConcepts,
      onDerivation: (chain: readonly Task[]) => {
        for (const cb of this.onDerivationCallbacks) cb(chain);
      },
    };

    if (this.inferenceController) {
      this.inferenceController.reconfigure({
        samplingStrategy: sampling,
        strategy,
        derivationStrategy,
        config: inferenceConfig,
      });
      return this.inferenceController;
    }

    return new InferenceController(
      this.memory,
      this.processor,
      sampling,
      strategy,
      derivationStrategy,
      inferenceConfig,
      this.budgets
    );
  }

  /** The one resolution call every slot makes. */
  private resolve<T>(type: StrategyType, params: CognitiveParameters): T {
    const slot = params.strategies[SLOT_KEY[type]] as StrategySlotParams;
    return this.registry.resolve<T>(type, slot.type, slot.config);
  }

  /**
   * `lm-graph` is the one strategy with a side effect: it owns the co-activation
   * graph, which premise selection reads. Registering it and publishing the
   * graph stay here; selecting it is the registry's job.
   */
  private resolveLMRule(params: CognitiveParameters): {
    selector: ModelRuleSelector;
    ruleGraph: RuleGraph | null;
  } {
    const slot = params.strategies.lmRule as StrategySlotParams;
    if (slot.type !== 'lm-graph') {
      return { selector: this.resolve<ModelRuleSelector>('lm-rule', params), ruleGraph: null };
    }

    const ruleGraph = this.registry.get<RuleGraph>('lm-rule', 'lm-graph');
    this.memory.attachConceptGraph(ruleGraph.graph);
    return { selector: ruleGraph, ruleGraph };
  }

  #wireRuleGraphCallbacks(ruleGraph: RuleGraph): void {
    this.onAdapt(() => {
      const log = this.processor.getModelRuleExecutionLog();
      for (const entry of log) {
        ruleGraph.recordPerformance(entry.ruleName, entry.status === 'fired', entry.durationMs);
      }
      this.processor.clearModelRuleExecutionLog();
      ruleGraph.tick();
    });

    this.onDerivation((chain) => {
      if (chain.length >= 2) {
        const primary = chain[0];
        const derived = chain[chain.length - 1];
        if (primary && derived) ruleGraph.learnFromDerivation(primary.term, derived.term);
      }
    });
  }

  private adaptWithRLFP(): CognitiveParameters {
    // P4 (TODO20): clone only the strategies subtree — the only part adaptation
    // mutates — instead of structuredClone-ing the full parameter graph.
    const adapted = {
      ...this.currentParams,
      strategies: structuredClone(this.currentParams.strategies),
    };
    if (this.rlfp && this.rlfp.preferences.length > 0) {
      adapted.strategies.lmRule.type = 'priority';
      adapted.strategies.derivation.type = 'focused';
    }
    return adapted;
  }
}

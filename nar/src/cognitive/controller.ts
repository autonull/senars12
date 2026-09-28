import { sameStrategies, type CognitiveParameters } from '../config/cognitive-parameters';
import type { Memory } from '../memory';
import type { MetricsCollector } from '../metrics';
import type { Strategy } from '../reason';
import type { Task } from '../types';
import { InferenceController } from '../reason/inference-controller';
import type { RLFPLearner } from '../rlfp';
import type { RuleProcessor } from '../rules';
import type {
  DerivationStrategy,
  LMRuleSelector,
  SamplingStrategy,
  StrategyType,
} from '../strategies';
import {
  composeStrategy,
  describeStrategyExpression,
  type StrategyExpression,
} from '../reason/strategy-algebra';
import type { CognitiveRegistry } from './registry';
import { registerRuleGraph, RuleGraph } from '../strategies/lm-graph/RuleGraph.js';

export class CognitiveController {
  private currentParams: CognitiveParameters;
  private readonly inferenceController: InferenceController;
  private cycleCount = 0;
  private readonly adaptInterval: number;
  private readonly onAdaptCallbacks: Array<() => void> = [];
  private readonly onDerivationCallbacks: Array<(chain: readonly Task[]) => void> = [];

  constructor(
    private readonly registry: CognitiveRegistry,
    private readonly memory: Memory,
    private readonly processor: RuleProcessor,
    private readonly metrics: MetricsCollector,
    private readonly rlfp: RLFPLearner | undefined,
    params: CognitiveParameters,
    adaptInterval = 50
  ) {
    // Own the parameter graph: callers may pass frozen defaults (TODO20 C3).
    this.currentParams = structuredClone(params);
    this.adaptInterval = adaptInterval;
    this.inferenceController = this.buildInferenceController(params);
  }

  getInferenceController(): InferenceController {
    return this.inferenceController;
  }

  getRegistry(): CognitiveRegistry {
    return this.registry;
  }

  /** Register a callback to be called on each adapt cycle */
  onAdapt(fn: () => void): () => void {
    this.onAdaptCallbacks.push(fn);
    return () => {
      const idx = this.onAdaptCallbacks.indexOf(fn);
      if (idx >= 0) this.onAdaptCallbacks.splice(idx, 1);
    };
  }

  /** Register a callback to be called on each derivation chain */
  onDerivation(fn: (chain: readonly Task[]) => void): () => void {
    this.onDerivationCallbacks.push(fn);
    return () => {
      const idx = this.onDerivationCallbacks.indexOf(fn);
      if (idx >= 0) this.onDerivationCallbacks.splice(idx, 1);
    };
  }

  /** Get the current strategy name for a strategy type, or undefined if unset */
  getStrategy(type: StrategyType): string | undefined {
    const key: keyof typeof this.currentParams.strategies =
      type === 'lm-rule' ? 'lmRule' : (type as keyof typeof this.currentParams.strategies);
    return this.currentParams.strategies[key]?.type;
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

  setStrategy(type: StrategyType, name: string | StrategyExpression): void {
    const key: keyof typeof this.currentParams.strategies =
      type === 'lm-rule' ? 'lmRule' : (type as keyof typeof this.currentParams.strategies);
    const resolved =
      typeof name === 'string'
        ? name
        : this.#composeAndRegister(type, describeStrategyExpression(name), name);
    this.currentParams.strategies[key].type = resolved;
    this.buildInferenceController(this.currentParams);
  }

  /**
   * Phase E (REFACTOR.todo2 §8): execute a composed `StrategyExpression`.
   * Deterministic label ⇒ idempotent registration (first compose wins, C7).
   */
  setStrategyExpression(type: StrategyType, expression: StrategyExpression): void {
    const key: keyof typeof this.currentParams.strategies =
      type === 'lm-rule' ? 'lmRule' : (type as keyof typeof this.currentParams.strategies);
    const name = describeStrategyExpression(expression);
    this.currentParams.strategies[key].type = this.#composeAndRegister(type, name, expression);
    this.buildInferenceController(this.currentParams);
  }

  #composeAndRegister(
    type: StrategyType,
    name: string,
    expression: StrategyExpression
  ): string {
    const composed = `composed:${name}`;
    if (this.registry.has(type, composed)) return composed;
    this.registry.register(
      type,
      composed,
      composeStrategy(expression, (primitive) => this.registry.get<DerivationStrategy>(type, primitive))
    );
    return composed;
  }

  private buildInferenceController(params: CognitiveParameters): InferenceController {
    const samplingStrategy = this.registry.get<SamplingStrategy>(
      'sampling',
      params.strategies.sampling.type
    );
    const strategy = this.registry.get<Strategy>('premise', params.strategies.premise.type);
    const derivationStrategy = this.registry.get<DerivationStrategy>(
      'derivation',
      params.strategies.derivation.type
    );
    
    // Register RuleGraph if selected (opt-in via config)
    const lmRuleType = params.strategies.lmRule.type;
    let lmSelector: LMRuleSelector;
    let ruleGraph: RuleGraph | null = null;
    
    if (lmRuleType === 'lm-graph') {
      if (!this.registry.has('lm-rule', 'lm-graph')) {
        ruleGraph = registerRuleGraph(this.registry);
      } else {
        ruleGraph = this.registry.get<RuleGraph>('lm-rule', 'lm-graph');
      }
      lmSelector = ruleGraph;
    } else {
      lmSelector = this.registry.get<LMRuleSelector>('lm-rule', lmRuleType);
    }

    this.processor.setLMSelector(lmSelector, params.strategies.lmRule.maxRules);

    // Wire RuleGraph callbacks via explicit lifecycle hooks if using lm-graph
    if (ruleGraph) {
      this.#wireRuleGraphCallbacks(ruleGraph);
    }

    const inferenceConfig = {
      maxDerivationsPerStep: params.inference.maxDerivationsPerStep,
      maxDerivationDepth: params.inference.maxDerivationDepth,
      enableCircularDetection: params.inference.enableCircularDetection ?? true,
      enableTraceCollection: params.inference.enableTraceCollection ?? false,
      cpuThrottleMs: params.inference.cpuThrottleMs ?? 0,
      singlePremiseLMRules: params.lm.singlePremiseEnabled ?? true,
      maxLMRulesPerStep: params.strategies.lmRule.maxRules,
      enableLMRules: params.lm.enabled ?? true,
      sampleSize: params.inference.maxDerivationsPerStep ?? 100,
      onDerivation: (chain: readonly Task[]) => {
        for (const cb of this.onDerivationCallbacks) cb(chain);
      },
    };

    if (this.inferenceController) {
      this.inferenceController.reconfigure({
        samplingStrategy,
        strategy,
        derivationStrategy,
        config: inferenceConfig,
      });
      return this.inferenceController;
    }

    return new InferenceController(
      this.memory,
      this.processor,
      samplingStrategy,
      strategy,
      derivationStrategy,
      inferenceConfig
    );
  }

  #wireRuleGraphCallbacks(ruleGraph: RuleGraph): void {
    // Register adapt callback for RuleGraph performance recording and ticking
    this.onAdapt(() => {
      // Record performance from execution log
      const log = this.processor.getLMRuleExecutionLog();
      for (const entry of log) {
        ruleGraph.recordPerformance(entry.ruleName, entry.status === 'fired', entry.durationMs);
      }
      this.processor.clearLMRuleExecutionLog();
      
      // Wire tick() from cycle
      ruleGraph.tick();
    });

    // Register derivation callback for RuleGraph learning
    this.onDerivation((chain: readonly Task[]) => {
      if (chain.length >= 2) {
        const primary = chain[0];
        const derived = chain[chain.length - 1];
        if (primary && derived) {
          // Use primary term as focus, derived term as rule term
          ruleGraph.learnFromDerivation(primary.term, derived.term);
        }
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

import type { CognitiveParameters } from '../config/cognitive-parameters';
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

export class CognitiveController {
  private currentParams: CognitiveParameters;
  private readonly inferenceController: InferenceController;
  private cycleCount = 0;
  private readonly adaptInterval: number;

  constructor(
    private readonly registry: CognitiveRegistry,
    private readonly memory: Memory,
    private readonly processor: RuleProcessor,
    private readonly metrics: MetricsCollector,
    private readonly rlfp: RLFPLearner | undefined,
    params: CognitiveParameters,
    adaptInterval = 50,
    private readonly onDerivation?: (chain: readonly Task[]) => void
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

  /** Get the current strategy name for a strategy type, or undefined if unset */
  getStrategy(type: StrategyType): string | undefined {
    const key: keyof typeof this.currentParams.strategies =
      type === 'lm-rule' ? 'lmRule' : (type as keyof typeof this.currentParams.strategies);
    return this.currentParams.strategies[key]?.type;
  }

  adapt(): void {
    this.cycleCount++;
    if (this.cycleCount % this.adaptInterval !== 0 || !this.rlfp) return;

    const newParams = this.adaptWithRLFP();
    if (JSON.stringify(newParams.strategies) !== JSON.stringify(this.currentParams.strategies)) {
      this.currentParams = newParams;
      this.buildInferenceController(newParams);
    }
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
    const lmSelector = this.registry.get<LMRuleSelector>('lm-rule', params.strategies.lmRule.type);

    this.processor.setLMSelector(lmSelector, params.strategies.lmRule.maxRules);

    const inferenceConfig = {
      maxDerivationsPerStep: params.inference.maxDerivationsPerStep,
      maxDerivationDepth: params.inference.maxDerivationDepth,
      enableCircularDetection: params.inference.enableCircularDetection ?? true,
      enableTraceCollection: params.inference.enableTraceCollection ?? false,
      cpuThrottleMs: params.inference.cpuThrottleMs ?? 0,
      singlePremiseLMRules: params.lm.singlePremiseEnabled ?? true,
      maxLMRulesPerStep: params.strategies.lmRule.maxRules,
      enableLMRules: params.lm.enabled ?? true,
      ...(this.onDerivation ? { onDerivation: this.onDerivation } : {}),
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

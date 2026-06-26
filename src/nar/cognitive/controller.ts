import type {CognitiveParameters} from '../config/cognitive-parameters';
import type {Memory} from '../memory/memory.js';
import type {RuleProcessor} from '../rules/processor.js';
import type {MetricsCollector} from '../metrics';
import type {RLFPLearner} from '../rlfp';
import {InferenceController} from '../reason/inference-controller';
import type {Strategy} from '../reason/strategy';
import type {DerivationStrategy, LMRuleSelector, SamplingStrategy, StrategyType} from '../strategies/types.js';
import {CognitiveRegistry} from './registry';

export class CognitiveController {
    private currentParams: CognitiveParameters;
    private inferenceController: InferenceController;
    private cycleCount = 0;
    private readonly adaptInterval: number;

    constructor(
        private readonly registry: CognitiveRegistry,
        private readonly memory: Memory,
        private readonly processor: RuleProcessor,
        private readonly metrics: MetricsCollector,
        private readonly rlfp: RLFPLearner | undefined,
        params: CognitiveParameters,
        adaptInterval = 50
    ) {
        this.currentParams = params;
        this.adaptInterval = adaptInterval;
        this.inferenceController = this.buildInferenceController(params);
    }

    getInferenceController(): InferenceController {
        return this.inferenceController;
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

    setStrategy(type: StrategyType, name: string): void {
        const key: keyof typeof this.currentParams.strategies = type === 'lm-rule' ? 'lmRule' : type as keyof typeof this.currentParams.strategies;
        this.currentParams.strategies[key].type = name;
        this.buildInferenceController(this.currentParams);
    }

    private buildInferenceController(params: CognitiveParameters): InferenceController {
        const samplingStrategy = this.registry.get<SamplingStrategy>('sampling', params.strategies.sampling.type);
        const strategy = this.registry.get<Strategy>('premise', params.strategies.premise.type);
        const derivationStrategy = this.registry.get<DerivationStrategy>('derivation', params.strategies.derivation.type);
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
            enableLMRules: params.lm.enabled ?? true
        };

        if (this.inferenceController) {
            this.inferenceController.reconfigure({
                samplingStrategy,
                strategy,
                derivationStrategy,
                config: inferenceConfig
            });
            return this.inferenceController;
        }

        return new InferenceController(this.memory, this.processor, samplingStrategy, strategy, derivationStrategy, inferenceConfig);
    }

    private adaptWithRLFP(): CognitiveParameters {
        const adapted = structuredClone(this.currentParams);
        if (this.rlfp && this.rlfp.preferences.length > 0) {
            adapted.strategies.lmRule.type = 'priority';
            adapted.strategies.derivation.type = 'focused';
        }
        return adapted;
    }
}

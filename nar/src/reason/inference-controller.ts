/**
 * Inference Controller - Orchestrates task sampling, secondary selection, and rule firing
 */

import type {Memory} from '../memory';
import type {RuleInput, RuleProcessor, RuleResult} from '../rules';
import type {DerivationContext, DerivationStrategy, SamplingStrategy} from '../strategies';
import type {Task} from '../types';
import {createBeliefTask, createCircularDetector, createDerivedTask, exceedsDepthLimit,} from './inference-utils.js';
import type {Strategy} from './strategy.js';

export interface InferenceConfig {
    maxDerivationsPerStep: number;
    maxDerivationDepth: number;
    enableCircularDetection: boolean;
    enableTraceCollection: boolean;
    cpuThrottleMs: number;
    singlePremiseLMRules: boolean;
    maxLMRulesPerStep: number;
    enableLMRules: boolean;
}

export class InferenceController {
    private derivationCount = 0;
    private lmRulesFiredCount = 0;
    private syncRulesFiredCount = 0;
    private readonly circularDetector = createCircularDetector();

    constructor(
        private readonly memory: Memory,
        private readonly processor: RuleProcessor,
        private samplingStrategy: SamplingStrategy,
        private strategy: Strategy,
        private derivationStrategy: DerivationStrategy,
        private readonly config: InferenceConfig
    ) {
    }

    reconfigure(updates: {
        samplingStrategy?: SamplingStrategy;
        strategy?: Strategy;
        derivationStrategy?: DerivationStrategy;
        config?: Partial<InferenceConfig>;
    }): void {
        if (updates.samplingStrategy) this.samplingStrategy = updates.samplingStrategy;
        if (updates.strategy) this.strategy = updates.strategy;
        if (updates.derivationStrategy) this.derivationStrategy = updates.derivationStrategy;
        if (updates.config) Object.assign(this.config, updates.config);
    }

    async step(timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
        const results: Task[] = [];
        const endTime = Date.now() + timeoutMs;
        this.derivationCount = 0;
        this.lmRulesFiredCount = 0;
        this.syncRulesFiredCount = 0;

        const concepts = this.samplingStrategy.sample(this.memory, 100);

        for (const concept of concepts) {
            if (signal?.aborted || Date.now() > endTime || results.length >= maxResults) break;

            const boost = this.memory.attentionModel.prime(concept, {
                concept,
                cycleCount: Date.now(),
                memory: this.memory,
            });
            if (boost !== 0) concept.priority = Math.min(1, concept.priority + boost);

            const task = createBeliefTask(concept);
            if (!task) continue;
            const secondaries = this.strategy.selectSecondary(task, this.memory);

            const ctx: DerivationContext = {
                maxDerivations: this.config.maxDerivationsPerStep,
                maxDepth: this.config.maxDerivationDepth,
                cpuThrottleMs: this.config.cpuThrottleMs,
                singlePremiseEnabled: this.config.singlePremiseLMRules ?? true,
                signal,
            };

            for await (const derived of this.derivationStrategy.derive(
                task,
                secondaries,
                this.processor,
                ctx
            )) {
                results.push(derived);
                this.derivationCount++;
                if (this.derivationCount >= this.config.maxDerivationsPerStep) break;
            }
        }

        return results;
    }

    async* run(maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
        let resultCount = 0;
        this.derivationCount = 0;
        this.lmRulesFiredCount = 0;
        this.syncRulesFiredCount = 0;

        const concepts = this.memory.sample(100);

        for (const concept of concepts) {
            if (signal?.aborted || resultCount >= maxResults) break;

            const task = createBeliefTask(concept);
            if (!task) continue;
            const secondaries = this.strategy.selectSecondary(task, this.memory);

            if (secondaries.length === 0 && this.config.singlePremiseLMRules) {
                yield* this.fireSinglePremiseRules(task, signal);
                resultCount++;
            } else {
                for (const secondary of secondaries) {
                    if (signal?.aborted || resultCount >= maxResults) break;

                    for await (const derivedTask of this.fireDualPremiseRules(task, secondary, signal)) {
                        yield derivedTask;
                        resultCount++;
                        if (this.config.cpuThrottleMs > 0) {
                            await new Promise((r) => setTimeout(r, this.config.cpuThrottleMs));
                        }
                    }
                }
            }
        }
    }

    getStats(): { derivations: number; lmRulesFired: number; syncRulesFired: number } {
        return {
            derivations: this.derivationCount,
            lmRulesFired: this.lmRulesFiredCount,
            syncRulesFired: this.syncRulesFiredCount,
        };
    }

    resetCircularDetection(): void {
        this.circularDetector.reset();
    }

    private async* fireSinglePremiseRules(task: Task, signal?: AbortSignal): AsyncGenerator<Task> {
        const p1: RuleInput = {term: task.term, truth: task.truth, stamp: task.stamp};
        const maxDepth = this.config.maxDerivationDepth ?? 10;

        for await (const result of this.processor.processLMRules(p1, undefined, {
            signal,
            singlePremise: true,
        })) {
            const derivedTask = createDerivedTask(result);
            if (exceedsDepthLimit(derivedTask, maxDepth) || this.isCircular(derivedTask)) continue;

            this.derivationCount++;
            this.lmRulesFiredCount++;

            yield derivedTask;
        }
    }

    private async* fireDualPremiseRules(
        p1Task: Task,
        p2Task: Task,
        signal?: AbortSignal
    ): AsyncGenerator<Task> {
        const p1: RuleInput = {term: p1Task.term, truth: p1Task.truth, stamp: p1Task.stamp};
        const p2: RuleInput = {term: p2Task.term, truth: p2Task.truth, stamp: p2Task.stamp};
        const maxDepth = this.config.maxDerivationDepth ?? 10;

        const processResult = (result: RuleResult) => {
            const derivedTask = createDerivedTask(result);
            if (exceedsDepthLimit(derivedTask, maxDepth) || this.isCircular(derivedTask)) return null;
            this.derivationCount++;
            return derivedTask;
        };

        for (const result of this.processor.processSync(p1, p2)) {
            this.syncRulesFiredCount++;
            const derived = processResult(result);
            if (derived) yield derived;
        }

        for await (const result of this.processor.processLMRules(p1, p2, {signal})) {
            this.lmRulesFiredCount++;
            const derived = processResult(result);
            if (derived) yield derived;
        }
    }

    private isCircular(task: Task): boolean {
        if (!this.config.enableCircularDetection) return false;
        return this.circularDetector.isCircular(task);
    }
}

/**
 * Reasoner for performing inference steps
 */

import type {CoreConfig, Task} from '../types';
import {Truth, createBudget, createTask} from '../types';
import type {Memory} from '../memory';
import type {RuleInput, RuleProcessor, RuleResult} from '../rules';
import type {Strategy} from './strategy.js';

export interface ReasonerConfig extends Pick<CoreConfig, 'cpuThrottleMs' | 'maxDerivationDepth' | 'maxDerivationsPerStep'> {
    enableCircularDetection?: boolean;
    enableTraceCollection?: boolean;
    premiseQualityThreshold?: number;
}

export interface ReasoningTrace {
    taskId: string;
    premises: Task[];
    result: Task;
    timestamp: number;
    derivationDepth: number;
}

export class Reasoner {
    private readonly memory: Memory;
    private readonly processor: RuleProcessor;
    private readonly strategy: Strategy;
    private readonly config: ReasonerConfig;
    private readonly recentStamps: Set<string> = new Set();
    private readonly traces: ReasoningTrace[] = [];
    private derivationCount = 0;
    private readonly maxRecentStamps = 1000;

    constructor(
        memory: Memory,
        processor: RuleProcessor,
        strategy: Strategy,
        config: ReasonerConfig
    ) {
        this.memory = memory;
        this.processor = processor;
        this.strategy = strategy;
        this.config = config;
    }

    async step(_timeoutMs = 5000, maxResults = 100): Promise<Task[]> {
        const results: Task[] = [];
        const startTime = Date.now();
        const endTime = startTime + _timeoutMs;
        this.derivationCount = 0;

        for (const concept of this.memory.sample(100)) {
            if (Date.now() > endTime || results.length >= maxResults) break;

            const belief = concept.beliefBag.peek();
            const task: Task = createTask(
                concept.term,
                'belief',
                belief?.truth ?? Truth.NEUTRAL,
                createBudget(concept.priority)
            );

            for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
                if (this.derivationCount >= (this.config.maxDerivationsPerStep ?? 1000)) break;
                if (!this.checkQualityThreshold(task, secondary)) continue;

                const p1: RuleInput = {term: task.term, truth: task.truth, stamp: task.stamp};
                const p2: RuleInput = {
                    term: secondary.term,
                    truth: secondary.truth ?? Truth.NEUTRAL,
                    stamp: secondary.stamp
                };

                for (const result of this.processor.processSync(p1, p2)) {
                    const derivedTask = this.createDerivedTask(result);

                    if (this.exceedsDepthLimit(derivedTask)) continue;
                    if (this.isCircular(derivedTask)) continue;

                    results.push(derivedTask);
                    this.derivationCount++;

                    if (this.config.enableTraceCollection) {
                        this.collectTrace([task, secondary], derivedTask);
                    }
                }
            }
        }

        return results;
    }

    async* run(_timeoutMs = 5000, maxResults = 100): AsyncGenerator<Task> {
        const _startTime = Date.now();
        let resultCount = 0;
        this.derivationCount = 0;

        for (const concept of this.memory.sample(100)) {
            if (resultCount >= maxResults) break;

            const belief = concept.beliefBag.peek();
            const task: Task = createTask(
                concept.term,
                'belief',
                belief?.truth ?? Truth.NEUTRAL,
                createBudget(concept.priority)
            );

            for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
                if (resultCount >= maxResults) break;
                if (this.derivationCount >= (this.config.maxDerivationsPerStep ?? 1000)) break;
                if (!this.checkQualityThreshold(task, secondary)) continue;

                const p1: RuleInput = {term: task.term, truth: task.truth, stamp: task.stamp};
                const p2: RuleInput = {
                    term: secondary.term,
                    truth: secondary.truth ?? Truth.NEUTRAL,
                    stamp: secondary.stamp
                };

                for (const result of this.processor.processSync(p1, p2)) {
                    const derivedTask = this.createDerivedTask(result);

                    if (this.exceedsDepthLimit(derivedTask)) continue;
                    if (this.isCircular(derivedTask)) continue;

                    yield derivedTask;
                    resultCount++;
                    this.derivationCount++;

                    if (this.config.enableTraceCollection) {
                        this.collectTrace([task, secondary], derivedTask);
                    }
                }

                if (this.config.cpuThrottleMs > 0) {
                    await new Promise(r => setTimeout(r, this.config.cpuThrottleMs));
                }
            }
        }
    }

    getTraces(): ReasoningTrace[] {
        return [...this.traces];
    }

    clearTraces(): void {
        this.traces.splice(0, this.traces.length);
    }

    getDerivationCount(): number {
        return this.derivationCount;
    }

    resetCircularDetection(): void {
        this.recentStamps.clear();
    }

    private createDerivedTask(result: RuleResult): Task {
        return {
            term: result.term,
            type: 'belief',
            truth: result.truth,
            budget: createBudget(result.priority),
            stamp: result.stamp,
            occurrenceTime: Date.now(),
            derived: true
        };
    }

    private exceedsDepthLimit(task: Task): boolean {
        const maxDepth = this.config.maxDerivationDepth ?? 10;
        const currentDepth = task.stamp?.depth ?? 0;
        return currentDepth >= maxDepth;
    }

    private isCircular(task: Task): boolean {
        if (!this.config.enableCircularDetection) return false;

        const stampId = task.stamp?.id;
        if (!stampId) return false;

        if (this.recentStamps.has(stampId)) {
            return true;
        }

        if (this.recentStamps.size >= this.maxRecentStamps) {
            const first = this.recentStamps.values().next().value;
            if (first) this.recentStamps.delete(first);
        }

        this.recentStamps.add(stampId);
        return false;
    }

    private checkQualityThreshold(p1: Task, p2: Task): boolean {
        const threshold = this.config.premiseQualityThreshold ?? 0;
        const p1Quality = p1.truth?.f ?? 0.5;
        const p2Quality = p2.truth?.f ?? 0.5;
        const combined = (p1Quality + p2Quality) / 2;
        return combined >= threshold;
    }

    private collectTrace(premises: Task[], result: Task): void {
        const trace: ReasoningTrace = {
            taskId: result.stamp?.id ?? '',
            premises,
            result,
            timestamp: Date.now(),
            derivationDepth: result.stamp?.depth ?? 0
        };

        this.traces.push(trace);

        if (this.traces.length > 1000) {
            this.traces.shift();
        }
    }
}

import type {CoreConfig, Task} from '../types';
import {Truth, createBudget, createTask} from '../types';
import type {Memory} from '../memory';
import type {Concept} from '../memory';
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

const toTask = (concept: Concept): Task => {
    const belief = concept.beliefBag.peek();
    return createTask(concept.term, 'belief', belief?.truth ?? Truth.NEUTRAL, createBudget(concept.priority));
};

const toRuleInput = (task: Task): RuleInput => ({term: task.term, truth: task.truth, stamp: task.stamp});

const toRuleInputWithDefault = (task: Task): RuleInput =>
    ({term: task.term, truth: task.truth ?? Truth.NEUTRAL, stamp: task.stamp});

export class Reasoner {
    private readonly memory: Memory;
    private readonly processor: RuleProcessor;
    private readonly strategy: Strategy;
    private readonly config: ReasonerConfig;
    private readonly recentStamps = new Set<string>();
    private readonly traces: ReasoningTrace[] = [];
    private derivationCount = 0;

    constructor(memory: Memory, processor: RuleProcessor, strategy: Strategy, config: ReasonerConfig) {
        this.memory = memory;
        this.processor = processor;
        this.strategy = strategy;
        this.config = config;
    }

    async step(_timeoutMs = 5000, maxResults = 100): Promise<Task[]> {
        const results: Task[] = [];
        const endTime = Date.now() + _timeoutMs;
        this.derivationCount = 0;

        for (const concept of this.memory.sample(100)) {
            if (Date.now() > endTime || results.length >= maxResults) break;
            const primary = toTask(concept);

            for (const secondary of this.strategy.selectSecondary(primary, this.memory)) {
                if (this.derivationCount >= (this.config.maxDerivationsPerStep ?? 1000)) break;
                if (!this.checkQuality(primary, secondary)) continue;

                for (const result of this.processor.processSync(toRuleInput(primary), toRuleInputWithDefault(secondary))) {
                    const derived = this.derive(result);
                    if (!this.exceedsDepth(derived) && !this.isCircular(derived)) {
                        results.push(derived);
                        this.derivationCount++;
                        if (this.config.enableTraceCollection) this.collectTrace([primary, secondary], derived);
                    }
                }
            }
        }
        return results;
    }

    async* run(_timeoutMs = 5000, maxResults = 100): AsyncGenerator<Task> {
        const _endTime = Date.now() + _timeoutMs;
        let count = 0;
        this.derivationCount = 0;

        for (const concept of this.memory.sample(100)) {
            if (count >= maxResults) break;
            const primary = toTask(concept);

            for (const secondary of this.strategy.selectSecondary(primary, this.memory)) {
                if (count >= maxResults || this.derivationCount >= (this.config.maxDerivationsPerStep ?? 1000)) break;
                if (!this.checkQuality(primary, secondary)) continue;

                for (const result of this.processor.processSync(toRuleInput(primary), toRuleInputWithDefault(secondary))) {
                    const derived = this.derive(result);
                    if (!this.exceedsDepth(derived) && !this.isCircular(derived)) {
                        yield derived;
                        count++;
                        this.derivationCount++;
                        if (this.config.enableTraceCollection) this.collectTrace([primary, secondary], derived);
                    }
                }

                if (this.config.cpuThrottleMs > 0) await new Promise(r => setTimeout(r, this.config.cpuThrottleMs));
            }
        }
    }

    getTraces(): ReasoningTrace[] { return [...this.traces]; }
    clearTraces(): void { this.traces.splice(0); }
    getDerivationCount(): number { return this.derivationCount; }
    resetCircularDetection(): void { this.recentStamps.clear(); }

    private derive(result: RuleResult): Task {
        return {term: result.term, type: 'belief', truth: result.truth, budget: createBudget(result.priority), stamp: result.stamp, occurrenceTime: Date.now(), derived: true};
    }

    private exceedsDepth(task: Task): boolean {
        return (task.stamp?.depth ?? 0) >= (this.config.maxDerivationDepth ?? 10);
    }

    private isCircular(task: Task): boolean {
        if (!this.config.enableCircularDetection) return false;
        const id = task.stamp?.id;
        if (!id) return false;
        if (this.recentStamps.has(id)) return true;
        if (this.recentStamps.size >= 1000) { const first = this.recentStamps.values().next().value; if (first) this.recentStamps.delete(first); }
        this.recentStamps.add(id);
        return false;
    }

    private checkQuality(p1: Task, p2: Task): boolean {
        const threshold = this.config.premiseQualityThreshold ?? 0;
        return ((p1.truth?.f ?? 0.5) + (p2.truth?.f ?? 0.5)) / 2 >= threshold;
    }

    private collectTrace(premises: Task[], result: Task): void {
        this.traces.push({taskId: result.stamp?.id ?? '', premises, result, timestamp: Date.now(), derivationDepth: result.stamp?.depth ?? 0});
        if (this.traces.length > 1000) this.traces.shift();
    }
}
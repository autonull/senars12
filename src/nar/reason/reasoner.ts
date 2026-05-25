/**
 * Reasoner for performing inference steps
 * Now uses InferenceController for comprehensive task sampling and rule firing
 */

import type {CoreConfig, Task} from '../types';
import {createBudget, createTask} from '../types';
import type {Memory, Concept} from '../memory';
import type {RuleInput, RuleProcessor, RuleResult} from '../rules';
import type {Strategy} from './strategy.js';
import type {Term} from '../terms';
import {InferenceController, type InferenceConfig} from './inference-controller.js';
import type {SamplingStrategy, DerivationStrategy} from '../cognitive/types';
import {PrioritySampling} from '../cognitive/sampling-strategies';
import {DefaultDerivation} from '../cognitive/derivation-strategies';

export interface ReasonerConfig extends Pick<CoreConfig, 'cpuThrottleMs' | 'maxDerivationDepth' | 'maxDerivationsPerStep'> {
	enableCircularDetection?: boolean;
	enableTraceCollection?: boolean;
	singlePremiseLMRules?: boolean;
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
	private readonly recentStamps = new Set<string>();
	private readonly traces: ReasoningTrace[] = [];
	private derivationCount = 0;
	private readonly maxRecentStamps = 1000;
	private readonly inferenceController: InferenceController;

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
		
		// Initialize inference controller with comprehensive config
		const inferenceConfig: InferenceConfig = {
			maxDerivationsPerStep: config.maxDerivationsPerStep ?? 1000,
			maxDerivationDepth: config.maxDerivationDepth ?? 10,
			enableCircularDetection: config.enableCircularDetection ?? false,
			enableTraceCollection: config.enableTraceCollection ?? false,
			cpuThrottleMs: config.cpuThrottleMs ?? 0,
			singlePremiseLMRules: config.singlePremiseLMRules ?? true,
			maxLMRulesPerStep: 13, // Allow all LM rules but gated by priority
			enableLMRules: true
		};
		this.inferenceController = new InferenceController(memory, processor, new PrioritySampling(), strategy, new DefaultDerivation(), inferenceConfig);
	}

  private createBeliefTask(concept: Concept): Task | null {
    const belief = concept.beliefBag.peek();
    if (!belief || !belief.truth) return null;
    return createTask(concept.term, 'belief', belief.truth, createBudget(concept.priority));
  }

	async step(_timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
		// Use the new inference controller for comprehensive task sampling and rule firing
		const results = await this.inferenceController.step(_timeoutMs, maxResults, signal);
		this.derivationCount += results.length;
		return results;
	}

	async* run(_timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
		// Delegate to inference controller's streaming implementation
		const maxResultsRef = {count: 0};
		for await (const task of this.inferenceController.run(maxResults, signal)) {
			yield task;
			maxResultsRef.count++;
			if (maxResultsRef.count >= maxResults) break;
		}
		this.derivationCount += maxResultsRef.count;
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

  private async* deriveFromSecondary(task: Task, signal?: AbortSignal): AsyncGenerator<Task> {
    const p1: RuleInput = {term: task.term, truth: task.truth, stamp: task.stamp};
    const maxDerive = this.config.maxDerivationsPerStep ?? 1000;
    const maxDepth = this.config.maxDerivationDepth ?? 10;

    for (const secondary of this.strategy.selectSecondary(task, this.memory)) {
      if (signal?.aborted || this.derivationCount >= maxDerive) break;

      const p2: RuleInput = {term: secondary.term, truth: secondary.truth, stamp: secondary.stamp};

      const processResult = (result: RuleResult) => {
        const derivedTask = this.createDerivedTask(result);
        if (this.exceedsDepthLimit(derivedTask, maxDepth) || this.isCircular(derivedTask)) return null;
        this.derivationCount++;
        if (this.config.enableTraceCollection) this.collectTrace([task, secondary], derivedTask);
        return derivedTask;
      };

      for (const result of this.processor.processSync(p1, p2)) {
        const derived = processResult(result);
        if (derived) yield derived;
      }

      for await (const result of this.processor.processLMRulesExternal(p1, p2, signal)) {
        const derived = processResult(result);
        if (derived) yield derived;
      }
    }
  }

    private exceedsDepthLimit(task: Task, maxDepth: number): boolean {
        return task.stamp.depth >= maxDepth;
    }

    private isCircular(task: Task): boolean {
        if (!this.config.enableCircularDetection) return false;
        const stampId = task.stamp.id;
        if (this.recentStamps.has(stampId)) return true;
        if (this.recentStamps.size >= this.maxRecentStamps) {
            const first = this.recentStamps.values().next().value;
            if (first) this.recentStamps.delete(first);
        }
        this.recentStamps.add(stampId);
        return false;
    }

  private createDerivedTask(result: RuleResult): Task {
    return {term: result.term, type: 'belief', truth: result.truth, budget: createBudget(result.priority), stamp: result.stamp, occurrenceTime: Date.now(), derived: true};
  }

  private collectTrace(premises: Task[], result: Task): void {
    this.traces.push({
      taskId: result.stamp.id,
      premises,
      result,
      timestamp: Date.now(),
      derivationDepth: result.stamp.depth
    });

    if (this.traces.length > 1000) this.traces.shift();
  }
}

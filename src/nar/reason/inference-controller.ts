/**
 * Inference Controller - Orchestrates task sampling, secondary selection, and rule firing
 * 
 * Manages the cognitive cycle:
 * 1. Sample tasks from memory based on priority and relevance
 * 2. For each task, attempt to find secondary concepts for pairing
 * 3. If secondary exists: fire sync rules + dual-premise LM rules on the pair
 * 4. If no secondary: fire single-premise LM rules for concept elaboration
 * 5. Yield derived tasks for memory integration
 */

import type {Task} from '../types/core.js';
import {createBudget} from '../types/core.js';
import type {Memory} from '../memory/memory.js';
import type {RuleInput, RuleProcessor, RuleResult} from '../rules/processor.js';
import type {Strategy} from './strategy.js';
import type {SamplingStrategy, DerivationStrategy, DerivationContext} from '../strategies/types.js';

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

export interface InferenceResult {
	derivedTasks: Task[];
	derivationCount: number;
	lmRulesFired: number;
	syncRulesFired: number;
}

export class InferenceController {
	private derivationCount = 0;
	private lmRulesFiredCount = 0;
	private syncRulesFiredCount = 0;
	private readonly recentStamps = new Set<string>();
	private readonly maxRecentStamps = 1000;

	constructor(
		private readonly memory: Memory,
		private readonly processor: RuleProcessor,
		private samplingStrategy: SamplingStrategy,
		private strategy: Strategy,
		private derivationStrategy: DerivationStrategy,
		private readonly config: InferenceConfig
	) {}

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

	/**
	 * Run a single inference step with comprehensive control
	 */
	async step(timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
		const results: Task[] = [];
		const endTime = Date.now() + timeoutMs;
		this.derivationCount = 0;
		this.lmRulesFiredCount = 0;
		this.syncRulesFiredCount = 0;

		// Sample concepts using pluggable SamplingStrategy
		const concepts = this.samplingStrategy.sample(this.memory, 100);
		
		for (const concept of concepts) {
			if (signal?.aborted || Date.now() > endTime || results.length >= maxResults) break;

			// Attention boost via Memory's AttentionModel
			const boost = this.memory.attentionModel.prime(concept, {
				concept, cycleCount: Date.now(), memory: this.memory
			});
			if (boost !== 0) concept.priority = Math.min(1, concept.priority + boost);

			const task = this.createBeliefTask(concept);
			if (!task) continue;
			const secondaries = this.strategy.selectSecondary(task, this.memory);

			const ctx: DerivationContext = {
				maxDerivations: this.config.maxDerivationsPerStep,
				maxDepth: this.config.maxDerivationDepth,
				cpuThrottleMs: this.config.cpuThrottleMs,
				singlePremiseEnabled: this.config.singlePremiseLMRules ?? true,
				signal
			};

			for await (const derived of this.derivationStrategy.derive(task, secondaries, this.processor, ctx)) {
				results.push(derived);
				this.derivationCount++;
				if (this.derivationCount >= this.config.maxDerivationsPerStep) break;
			}
		}

		return results;
	}

	/**
	 * Async generator for running inference (streaming results)
	 */
	async* run(maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
		let resultCount = 0;
		this.derivationCount = 0;
		this.lmRulesFiredCount = 0;
		this.syncRulesFiredCount = 0;

		const concepts = this.memory.sample(100);
		
		for (const concept of concepts) {
			if (signal?.aborted || resultCount >= maxResults) break;

			const task = this.createBeliefTask(concept);
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
							await new Promise(r => setTimeout(r, this.config.cpuThrottleMs));
						}
					}
				}
			}
		}
	}

	/**
	 * Fire LM rules on a single premise (no secondary)
	 * Used for concept elaboration when no pairing is available
	 */
	private async* fireSinglePremiseRules(task: Task, signal?: AbortSignal): AsyncGenerator<Task> {
		const p1: RuleInput = {term: task.term, truth: task.truth, stamp: task.stamp};
		const maxDepth = this.config.maxDerivationDepth ?? 10;

		for await (const result of this.processor.processLMRules(p1, undefined, {signal, singlePremise: true})) {
			const derivedTask = this.createDerivedTask(result);
			if (this.exceedsDepthLimit(derivedTask, maxDepth) || this.isCircular(derivedTask)) continue;
			
			this.derivationCount++;
			this.lmRulesFiredCount++;
			if (this.config.enableTraceCollection) this.collectTrace([task], derivedTask);
			
			yield derivedTask;
		}
	}

	/**
	 * Fire sync and LM rules on a premise pair
	 */
	private async* fireDualPremiseRules(p1Task: Task, p2Task: Task, signal?: AbortSignal): AsyncGenerator<Task> {
		const p1: RuleInput = {term: p1Task.term, truth: p1Task.truth, stamp: p1Task.stamp};
		const p2: RuleInput = {term: p2Task.term, truth: p2Task.truth, stamp: p2Task.stamp};
		const maxDepth = this.config.maxDerivationDepth ?? 10;

		const processResult = (result: RuleResult) => {
			const derivedTask = this.createDerivedTask(result);
			if (this.exceedsDepthLimit(derivedTask, maxDepth) || this.isCircular(derivedTask)) return null;
			this.derivationCount++;
			if (this.config.enableTraceCollection) this.collectTrace([p1Task, p2Task], derivedTask);
			return derivedTask;
		};

		// Fire synchronous inference rules
		for (const result of this.processor.processSync(p1, p2)) {
			this.syncRulesFiredCount++;
			const derived = processResult(result);
			if (derived) yield derived;
		}

		// Fire LM-based rules on the premise pair
		for await (const result of this.processor.processLMRules(p1, p2, {signal})) {
			this.lmRulesFiredCount++;
			const derived = processResult(result);
			if (derived) yield derived;
		}
	}

	private createBeliefTask(concept: any): Task | null {
		const belief = concept.beliefBag?.peek?.();
		if (!belief) return null;
		return {
			term: concept.term,
			type: 'belief' as const,
			truth: belief.truth,
			budget: createBudget(concept.priority),
			stamp: belief.stamp,
			occurrenceTime: Date.now() as any,
			derived: false
		};
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
		return {
			term: result.term,
			type: 'belief',
			truth: result.truth,
			budget: createBudget(result.priority),
			stamp: result.stamp,
			occurrenceTime: Date.now() as any,
			derived: true
		};
	}

	private collectTrace(_premises: Task[], _result: Task): void {
		// Trace collection logic
	}

	getStats(): {derivations: number; lmRulesFired: number; syncRulesFired: number} {
		return {
			derivations: this.derivationCount,
			lmRulesFired: this.lmRulesFiredCount,
			syncRulesFired: this.syncRulesFiredCount
		};
	}

	resetCircularDetection(): void {
		this.recentStamps.clear();
	}
}

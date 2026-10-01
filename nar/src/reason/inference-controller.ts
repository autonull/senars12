/**
 * Inference Controller - Orchestrates task sampling, secondary selection, and rule firing
 */

import { sleep } from '@senars/util';
import type { ControlBudgetPort } from '../kernel/control-budgets.js';
import type { MemoryView } from '../memory/view.js';
import type { RuleProcessor } from '../rules';
import type {
  AttentionModel,
  DerivationContext,
  DerivationStrategy,
  SamplingStrategy,
} from '../strategies';
import type { Task } from '../types';
import {
  createBeliefTaskFromConcept,
  createCircularDetector,
  exceedsDepthLimit,
} from './inference-utils.js';
import type { Strategy } from '../strategies/types.js';

export interface InferenceConfig {
  maxDerivationsPerStep: number;
  maxDerivationDepth: number;
  enableCircularDetection: boolean;
  cpuThrottleMs: number;
  singlePremiseLMRules: boolean;
  /** Concepts sampled per cycle — `CognitiveParameters.inference.maxSampledConcepts`. */
  sampleSize: number;
  /** Optional derivation-chain sink (TODO25 follow-on: SchemaInductor fuel). */
  onDerivation?: (chain: readonly Task[]) => void;
}

/**
 * What the cycle reads: the memory read port, plus the attention slot's live
 * model. `Memory` satisfies both structurally, so the composition root passes
 * the facade and nothing here can name it (TODO29.a §5.5).
 */
export type InferenceMemory = MemoryView & { readonly attentionModel: AttentionModel };

/** How one cycle is paced: a batch step is deadline-bounded, a stream yields cooperatively. */
interface CyclePacing {
  maxResults: number;
  /** Epoch ms after which the cycle stops; absent means the caller has no deadline. */
  deadlineMs?: number;
  /** Cooperative yield between derivations (AIKR). */
  paceMs: number;
}

export class InferenceController {
  private derivationCount = 0;
  private readonly circularDetector = createCircularDetector();

  constructor(
    private readonly memory: InferenceMemory,
    private readonly processor: RuleProcessor,
    private samplingStrategy: SamplingStrategy,
    private strategy: Strategy,
    private derivationStrategy: DerivationStrategy,
    private readonly config: InferenceConfig,
    /**
     * The declared control budgets (TODO29.a §5.7). Absent ⇒ the config bounds
     * stand alone, which is what a bare controller in a unit test means; the
     * cycle path always binds one.
     */
    private readonly budgets?: ControlBudgetPort
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

  async step(timeoutMs = 5000, maxResults = 100, signal?: AbortSignal): Promise<Task[]> {
    const results: Task[] = [];
    const pacing: CyclePacing = { maxResults, deadlineMs: Date.now() + timeoutMs, paceMs: 0 };
    for await (const derived of this.cycle(pacing, signal)) results.push(derived);
    return results;
  }

  async *run(maxResults = 100, signal?: AbortSignal): AsyncGenerator<Task> {
    // Unbounded by anything but `maxResults`, so the cycle paces itself by yielding.
    yield* this.cycle(
      { maxResults, paceMs: this.config.cpuThrottleMs },
      signal
    );
  }

  getStats(): { derivations: number } {
    return { derivations: this.derivationCount };
  }

  resetCircularDetection(): void {
    this.circularDetector.reset();
  }

  /**
   * The one inference cycle. It samples concepts, primes them, selects premises,
   * derives through the configured strategy, and admits what survives the AIKR
   * bounds — so every entry point reasons through the same strategies and the
   * same limits, and the guards exist once rather than per caller.
   */
  private async *cycle(pacing: CyclePacing, signal?: AbortSignal): AsyncGenerator<Task> {
    const { maxResults, deadlineMs, paceMs } = pacing;
    this.derivationCount = 0;

    const maxDepth = this.config.maxDerivationDepth;
    const outOfTime = () => deadlineMs !== undefined && Date.now() > deadlineMs;
    let emitted = 0;

    const concepts = this.samplingStrategy.sample(this.memory, this.config.sampleSize);

    for (const concept of concepts) {
      if (signal?.aborted || emitted >= maxResults || outOfTime()) return;

      const boost = this.memory.attentionModel.prime(concept, {
        concept,
        cycleCount: Date.now(),
        memory: this.memory,
      });
      if (boost !== 0) concept.writeAttention({ reason: 'prime', amount: boost });

const task = createBeliefTaskFromConcept(concept);
        if (!task) continue;
        // Secondary premise consideration is its own declared bound (§5.7): a
        // population-sized scan is unbounded work in a step that is not. Absent
        // a budget port the consideration is unbudgeted, as it always was.
        const consider = this.budgets ? this.budgets.charge('premises') : true;
        if (!consider) return;
        const secondaries = this.strategy.selectSecondary(task, this.memory);

      const ctx: DerivationContext = {
        maxDerivations: this.config.maxDerivationsPerStep,
        maxDepth,
        cpuThrottleMs: paceMs,
        singlePremiseEnabled: this.config.singlePremiseLMRules ?? true,
        signal,
      };

      for await (const derived of this.derivationStrategy.derive(
        task,
        secondaries,
        this.processor,
        ctx
      )) {
        if (signal?.aborted || outOfTime()) return;
        if (exceedsDepthLimit(derived, maxDepth) || this.isCircular(derived)) continue;

        this.derivationCount++;
        this.config.onDerivation?.([task, ...secondaries, derived]);
        yield derived;

        if (++emitted >= maxResults || this.derivationBudgetSpent()) return;
        if (paceMs > 0) await sleep(paceMs);
      }
    }
  }

  /**
   * Whether this cycle has spent its symbolic derivation bound. With a budget
   * port bound, that is the declared `derivations` scope — whose ceiling the
   * composition root sets from `inference.maxDerivationsPerStep`, so the count is
   * the same one the config always bounded. Without one (a bare controller in a
   * unit test) the config bound stands alone.
   */
  private derivationBudgetSpent(): boolean {
    if (this.budgets) return !this.budgets.charge('derivations');
    return this.derivationCount >= this.config.maxDerivationsPerStep;
  }

  private isCircular(task: Task): boolean {
    if (!this.config.enableCircularDetection) return false;
    return this.circularDetector.isCircular(task);
  }
}

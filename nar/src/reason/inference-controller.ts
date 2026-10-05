/**
 * Inference Controller - Orchestrates task sampling, secondary selection, and rule firing
 */

import { sleep } from '@senars/util';
import { type ControlBudgetPort, UNBUDGETED } from '../kernel/control-budgets.js';
import type { MemoryView } from '../memory/view.js';
import type { RuleProcessor } from '../rules';
import type {
  AttentionModel,
  DerivationContext,
  DerivationStrategy,
  SamplingStrategy,
} from '../strategies';
import type { Task } from '../types';
import { createCircularDetector, exceedsDepthLimit } from './inference-utils.js';
import type { Strategy } from '../strategies/types.js';
import type { InferenceConfig as CognitiveInferenceConfig } from '../config/cognitive-parameters.js';

/**
 * What one cycle reads, plus the derivation-chain sink.
 *
 * The parameter graph's own `inference` section, extended — not a second
 * declaration of the same six knobs, one of which had been renamed on the way in
 * (`sampleSize` for `maxSampledConcepts`). The restatement meant every
 * reconfigure spelled out the field-by-field mapping and a knob renamed on one
 * side silently stopped reaching the cycle; deriving it means a new `inference`
 * entry arrives here by being added to the graph at all.
 */
export type InferenceConfig = CognitiveInferenceConfig & {
  /** Optional derivation-chain sink (TODO25 follow-on: SchemaInductor fuel). */
  onDerivation?: (chain: readonly Task[]) => void;
};

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
     * The declared control budgets (TODO29.a §5.7). Defaults to
     * {@link UNBUDGETED}, so a bare controller in a unit test is unbudgeted
     * rather than unguarded; the cycle path always binds a real one.
     */
    private readonly budgets: ControlBudgetPort = UNBUDGETED
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
    yield* this.cycle({ maxResults, paceMs: this.config.cpuThrottleMs }, signal);
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

    const concepts = this.samplingStrategy.sample(this.memory, this.config.maxSampledConcepts);

    // Every sampled concept derives through the same bounds, so the context is
    // built once. `onDerivation` is absent in the common configuration, and the
    // chain it takes is allocated only when it is there.
    const ctx: DerivationContext = {
      maxDerivations: this.config.maxDerivationsPerStep,
      maxDepth,
      cpuThrottleMs: paceMs,
      singlePremiseEnabled: this.config.singlePremiseLMRules ?? true,
      signal,
    };
    const onDerivation = this.config.onDerivation;

    for (const concept of concepts) {
      if (signal?.aborted || emitted >= maxResults || outOfTime()) return;

      const boost = this.memory.attentionModel.prime(concept, {
        concept,
        cycleCount: Date.now(),
        memory: this.memory,
      });
      if (boost !== 0) concept.writeAttention({ reason: 'prime', amount: boost });

      const task = concept.beliefTask();
      if (!task) continue;
      // Secondary premise consideration is its own declared bound (§5.7): a
      // population-sized scan is unbounded work in a step that is not.
      if (!this.budgets.charge('premises')) return;
      const secondaries = this.strategy.selectSecondary(task, this.memory);

      for await (const derived of this.derivationStrategy.derive(
        task,
        secondaries,
        this.processor,
        ctx
      )) {
        if (signal?.aborted || outOfTime()) return;
        if (exceedsDepthLimit(derived, maxDepth) || this.isCircular(derived)) continue;

        this.derivationCount++;
        if (onDerivation) onDerivation([task, ...secondaries, derived]);
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
    return this.budgets.budgeted
      ? !this.budgets.charge('derivations')
      : this.derivationCount >= this.config.maxDerivationsPerStep;
  }

  private isCircular(task: Task): boolean {
    if (!this.config.enableCircularDetection) return false;
    return this.circularDetector.isCircular(task);
  }
}

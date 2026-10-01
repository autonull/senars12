/**
 * The producer side of the proposal seam (TODO29.a A1, §5.1 step 2).
 *
 * The cycle stages model-backed rule work through {@link LMProposalProducer.stage}
 * — a bounded queue — and nothing else. Applying it happens in `pump`, which the
 * cycle never awaits, so a provider that never answers cannot hold a cycle open
 * (TODO29.a §1.3). What the pump produces is drained at the *next* cycle's
 * `authorize` stage and admitted through the perception gate like any other
 * derivation: a proposal reaches state at a declared boundary or not at all.
 *
 * The queue is the `StreamReasoner`'s, not a second one. Two queues would be two
 * accounts of the same backlog, and the overflow policy would be whichever one
 * someone remembered to check.
 */

import { createDerivedTask } from '../reason/inference-utils.js';
import type { LMRuleWork, LMRuleWorkSink, RuleResult } from '../rules/types.js';
import type { LMBackend, StreamReasoner, StreamReasonerStats } from '../stream/reasoner.js';
import type { Task } from '../types';

/** Applies one staged unit of work. Structurally `RuleProcessor`. */
export interface LMRuleWorkApplicator {
  applyLMRules(work: LMRuleWork, signal?: AbortSignal): AsyncGenerator<RuleResult>;
}

export interface LMProposalProducerOptions {
  /** No prompt-only requests are staged by the cycle, so the batch backend answers none. */
  backend?: LMBackend;
}

/** A batch backend that answers nothing — every production request carries a `derive`. */
const NO_PROMPT_REQUESTS: LMBackend = async () => new Map();

export class LMProposalProducer implements LMRuleWorkSink {
  private readonly reasoner: StreamReasoner;
  private readonly applicator: LMRuleWorkApplicator;
  private readonly backend: LMBackend;
  private readonly counters = { staged: 0, refused: 0, applied: 0 };
  private inFlight: Promise<void> = Promise.resolve();
  private signal?: AbortSignal;

  constructor(
    reasoner: StreamReasoner,
    applicator: LMRuleWorkApplicator,
    options: LMProposalProducerOptions = {}
  ) {
    this.reasoner = reasoner;
    this.applicator = applicator;
    this.backend = options.backend ?? NO_PROMPT_REQUESTS;
  }

  /** Called from the cycle. Bounded, synchronous, and cheap: a queue push. */
  stage(work: LMRuleWork): boolean {
    const queued = this.reasoner.dispatch(
      work.p1.term.toString(),
      work.p1.truth,
      async () => this.applyWork(work)
    );
    if (!queued) {
      this.counters.refused++;
      return false;
    }
    this.counters.staged++;
    return true;
  }

  /**
   * Off-cycle. Returns the flush so a caller that *is* allowed to wait — a test,
   * `whenSettled` — can; the cycle itself discards it, which is what keeps a
   * provider's latency out of the cycle's progress.
   */
  pump(signal?: AbortSignal): Promise<void> {
    this.signal = signal;
    this.inFlight = this.inFlight
      .then(() => this.reasoner.flush(this.backend, this.reasoner.pressure()))
      .then(() => undefined);
    return this.inFlight;
  }

  /** Resolves when no flush is outstanding. Bounded by every await inside it. */
  whenSettled(): Promise<void> {
    return this.inFlight;
  }

  /** Settled derivations awaiting the next boundary. */
  takeDerived(): Task[] {
    return this.reasoner.takeDerived();
  }

  stats(): StreamReasonerStats & typeof this.counters {
    return { ...this.reasoner.stats(), ...this.counters };
  }

  private async applyWork(work: LMRuleWork): Promise<Task[]> {
    const tasks: Task[] = [];
    for await (const result of this.applicator.applyLMRules(work, this.signal)) {
      tasks.push(createDerivedTask(result));
    }
    this.counters.applied += tasks.length;
    return tasks;
  }
}

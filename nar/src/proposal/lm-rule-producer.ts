/**
 * The producer side of the proposal seam (TODO29.a A1, §5.1 step 2; A3).
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
 * someone remembered to check. What A3 added is the *lifecycle* the drained work
 * passes through: a derived task becomes a `ContentProposal` carrying the
 * premises it read, and only a proposal the lifecycle admits reaches the gate.
 *
 * **Why no parallel revision bookkeeping.** `stage` runs at `propose` and
 * `admit` at the next `authorize`, and a commit only ever happens inside that
 * `admit`. So everything drained at one boundary was staged since the last one
 * with no commit in between, and the revision it was observed at is the
 * committed revision — by construction. Staleness still fires when something
 * outside this producer commits, which is exactly the case the rule is for.
 */

import type { CognitiveEvent, ContentProposal } from '@senars/core/schemas';
import { PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import { ProposalLifecycle } from './lifecycle.js';
import { createDerivedTask } from '../reason/inference-utils.js';
import type { ModelRuleWork, ModelRuleWorkSink, RuleResult } from '../rules/types.js';
import type { LMBackend, StreamReasoner, StreamReasonerStats } from '../stream/reasoner.js';
import type { Task } from '../types';

/** Applies one staged unit of work. Structurally `RuleProcessor`. */
export interface ModelRuleWorkApplicator {
  applyModelRules(work: ModelRuleWork, signal?: AbortSignal): AsyncGenerator<RuleResult>;
}

export interface LMProposalProducerOptions {
  /** No prompt-only requests are staged by the cycle, so the batch backend answers none. */
  backend?: LMBackend;
  /** Where committed admissions and every rejection are appended. */
  record?: (event: CognitiveEvent) => void;
  /** Whether a term the proposal read still resolves. Absent ⇒ nothing is evicted. */
  resolves?: (term: string) => boolean;
  /** Cycles of derivation per proposal — the trigger is a work budget, not a rate. */
  cyclesPerProposal?: number;
}

/** A batch backend that answers nothing — every production request carries a `derive`. */
const NO_PROMPT_REQUESTS: LMBackend = async () => new Map();

export class LMProposalProducer implements ModelRuleWorkSink {
  private readonly reasoner: StreamReasoner;
  private readonly applicator: ModelRuleWorkApplicator;
  private readonly backend: LMBackend;
  private readonly lifecycle: ProposalLifecycle;
  private readonly resolves: (term: string) => boolean;
  private readonly cyclesPerProposal: number;
  /**
   * The premises each derived task read, in the order {@link applyWork} produced
   * them. `StreamReasoner.takeDerived` drains in the same order, so this pairs
   * exactly — a side channel rather than a widened `derive` signature, because
   * the task is what the cycle admits and the premises are what it was judged on.
   */
  private readonly premises: string[][] = [];
  private counters = { staged: 0, refused: 0, applied: 0 };
  private inFlight: Promise<void> = Promise.resolve();
  private signal?: AbortSignal;

  constructor(
    reasoner: StreamReasoner,
    applicator: ModelRuleWorkApplicator,
    options: LMProposalProducerOptions = {}
  ) {
    this.reasoner = reasoner;
    this.applicator = applicator;
    this.backend = options.backend ?? NO_PROMPT_REQUESTS;
    this.resolves = options.resolves ?? (() => true);
    this.cyclesPerProposal = options.cyclesPerProposal ?? 1;
    this.lifecycle = new ProposalLifecycle(undefined, options.record);
  }

  /** Called from the cycle. Bounded, synchronous, and cheap: a queue push. */
  stage(work: ModelRuleWork): boolean {
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

  /**
   * The declared boundary. Settled derivations become content proposals, the
   * lifecycle judges and commits the batch as one pass, and only what landed is
   * returned — so a task is absent because the lifecycle refused it *with a
   * recorded reason*, never because the gate silently ate it.
   */
  takeDerived(): Task[] {
    const settled = this.reasoner.takeDerived();
    const references = this.premises.splice(0, settled.length);
    const landed = new Map<string, Task>();
    for (const [at, task] of settled.entries()) {
      const proposal = this.proposalOf(task, references[at] ?? []);
      if (this.lifecycle.submit(proposal)) landed.set(proposal.proposalId, task);
    }
    return this.lifecycle.admit({ resolves: this.resolves }).flatMap((verdict) => {
      if (!verdict.admitted) return [];
      const task = landed.get(verdict.proposal.proposalId);
      if (!task) return [];
      this.lifecycle.commit(verdict, task.stamp.id);
      return [task];
    });
  }

  stats(): StreamReasonerStats & typeof this.counters {
    return { ...this.reasoner.stats(), ...this.counters };
  }

  /** The seam's audit surface: what the queues refused, and the committed revision. */
  lifecycleStats(): ReturnType<ProposalLifecycle['stats']> {
    return this.lifecycle.stats();
  }

  /** The revision proposals are judged against — the one the admission events state. */
  get revision(): number {
    return this.lifecycle.stats().revision;
  }

  private proposalOf(task: Task, references: readonly string[]): ContentProposal {
    return {
      proposalId: `prop-${task.stamp.id}`,
      schemaVersion: PROPOSAL_SCHEMA_VERSION,
      baseRevision: this.lifecycle.stats().revision,
      cyclesPerProposal: this.cyclesPerProposal,
      issuedAtCycle: 0,
      kind: 'content',
      payload: {
        taskType: task.type,
        term: task.term.toString(),
        truth: task.truth ? { frequency: task.truth.f, confidence: task.truth.c } : undefined,
      },
      references: [...references],
    };
  }

  private async applyWork(work: ModelRuleWork): Promise<Task[]> {
    const tasks: Task[] = [];
    const read = [work.p1.term.toString(), work.p2?.term.toString()].filter(
      (term): term is string => term !== undefined
    );
    for await (const result of this.applicator.applyModelRules(work, this.signal)) {
      tasks.push(createDerivedTask(result));
      this.premises.push(read);
    }
    this.counters.applied += tasks.length;
    return tasks;
  }
}
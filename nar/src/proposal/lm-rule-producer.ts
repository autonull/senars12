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
 * **A rule proposal changes the rule table, not memory** (TODO29.a §5.10). So
 * the drained batch is routed by kind: a content proposal becomes a task the
 * perception gate admits, and a rule proposal becomes a *declaration* handed to
 * the {@link RuleAdmission} sink, which writes it into the loaded table at the
 * revision the committing event stated. That is the path A3 left with nothing on
 * the other side — a well-formed new reaction now has somewhere to become one.
 *
 * **Why no parallel revision bookkeeping.** `stage` runs at `propose` and
 * `admit` at the next `authorize`, and a commit only ever happens inside that
 * `admit`. So everything drained at one boundary was staged since the last one
 * with no commit in between, and the revision it was observed at is the
 * committed revision — by construction. Staleness still fires when something
 * outside this producer commits, which is exactly the case the rule is for.
 */

import type {
  CognitiveEvent,
  ContentProposal,
  RuleDeclaration,
  RuleProposal,
} from '@senars/core/schemas';
import { PROPOSAL_SCHEMA_VERSION } from '@senars/core/schemas';
import { SerialQueue } from '@senars/util';
import { createDerivedTask } from '../reason/inference-utils.js';
import type { ModelRuleWork, ModelRuleWorkSink, RuleResult } from '../rules/types.js';
import type { LMBackend, StreamReasoner, StreamReasonerStats } from '../stream/reasoner.js';
import type { Task } from '../types';
import { ProposalLifecycle } from './lifecycle.js';

/** Applies one staged unit of work. Structurally `RuleProcessor`. */
export interface ModelRuleWorkApplicator {
  applyModelRules(work: ModelRuleWork, signal?: AbortSignal): AsyncGenerator<RuleResult>;
}

/**
 * Where an admitted **rule** declaration goes. The table owns the revision and
 * the event; this is only the door, so the producer never learns what a table is.
 */
export interface RuleAdmission {
  admit(
    declaration: RuleDeclaration,
    admitted: { revision: number; baseRevision: number; proposalId: string }
  ): void;
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
  /** Absent ⇒ a rule proposal is admitted to the lifecycle and goes nowhere else. */
  admitRule?: RuleAdmission;
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
  private readonly admitRule?: RuleAdmission;
  /**
   * The premises each derived task read, in the order {@link applyWork} produced
   * them. `StreamReasoner.takeDerived` drains in the same order, so this pairs
   * exactly — a side channel rather than a widened `derive` signature, because
   * the task is what the cycle admits and the premises are what it was judged on.
   */
  private readonly premises: string[][] = [];
  private counters = { staged: 0, refused: 0, applied: 0 };
  private readonly flushes = new SerialQueue();
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
    this.admitRule = options.admitRule;
    this.lifecycle = new ProposalLifecycle(undefined, options.record);
  }

  /**
   * Submit a rule proposal. Nothing is applied here — the declaration lands at
   * the next boundary, exactly as a content proposal does, and a rule queue that
   * is full *refuses loudly* rather than dropping the learned capability (§5.3).
   */
  submitRule(proposal: RuleProposal): boolean {
    return this.lifecycle.submit(proposal);
  }

  /** Called from the cycle. Bounded, synchronous, and cheap: a queue push. */
  stage(work: ModelRuleWork): boolean {
    const queued = this.reasoner.dispatch(work.p1.term.toString(), work.p1.truth, async () =>
      this.applyWork(work)
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
    return this.flushes.run(async () => {
      await this.reasoner.flush(this.backend, this.reasoner.pressure());
    });
  }

  /** Resolves when no flush is outstanding. Bounded by every await inside it. */
  whenSettled(): Promise<void> {
    return this.flushes.idle();
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
    const verdicts = this.lifecycle.admit({ resolves: this.resolves });
    const tasks: Task[] = [];
    for (const verdict of verdicts) {
      if (!verdict.admitted) continue;
      const { proposal } = verdict;
      if (proposal.kind === 'rule') {
        const revision = this.lifecycle.commit(verdict);
        this.admitRule?.admit(this.declarationOf(proposal), {
          revision,
          baseRevision: proposal.baseRevision,
          proposalId: proposal.proposalId,
        });
        continue;
      }
      const task = landed.get(proposal.proposalId);
      if (!task) continue;
      this.lifecycle.commit(verdict, task.stamp.id);
      tasks.push(task);
    }
    return tasks;
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

  /** A rule proposal as a table declaration: the payload without the envelope. */
  private declarationOf(proposal: RuleProposal): RuleDeclaration {
    const body = proposal.payload.body;
    if (!body) throw new Error('body required for rule declaration');
    return {
      ruleId: proposal.payload.ruleId,
      description: proposal.payload.name,
      left: { op: proposal.payload.pattern.left.op },
      right: { op: proposal.payload.pattern.right.op },
      truthFn: proposal.payload.truthFn,
      body,
      priority: proposal.payload.priority,
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

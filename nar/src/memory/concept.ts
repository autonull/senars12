import { asBeliefTruth, type BeliefTruth, clamp01, makeId } from '@senars/util';
import { type Bag, type BagOptions, createBag } from '../bag/index.js';
import type { ResolvedBagSlot } from '../bag/registration.js';
import type { Term, Truth } from '../terms';
import { calculateSimilarity, Stamp, TermMap, TermSet, termKey, termsEqual } from '../terms';
import { type IndependenceStatus, Truth as TruthOps } from '../terms/impls/Truth.js';
import type { Budget, TaskType } from '../types';
import { jaccard } from '../utils/similarity.js';

export type { IndependenceStatus };

/**
 * Why a concept's attention is being written, and by how much.
 *
 * `priority` has no public setter, so this union *is* the write surface: a
 * writer names a reason and the compiler rejects anything outside the list. The
 * reasons are the operations the plan enumerates — input touch, prime, related
 * touch, decay and self-tune, each a delta, and `assign` / `merge`, which
 * replace the value outright — and each has one caller, so a value's history is
 * readable off its reason (TODO29.a §5.4).
 */
export type AttentionEvent =
  /** A task was admitted, or an existing one re-observed. */
  | { readonly reason: 'input' }
  /**
   * An absolute value, written verbatim: a deserialised dump, a replayed
   * activation event, or a sensor that computed a priority of its own. The
   * shared shape is that the writer already decided the value and attention is
   * not a factor in it.
   */
  | { readonly reason: 'assign'; readonly value: number }
  /** The attention slot primed this concept itself. */
  | { readonly reason: 'prime'; readonly amount: number; readonly cap?: number }
  /** A neighbour of this concept was primed, and the activation spread. */
  | { readonly reason: 'related'; readonly amount: number; readonly cap?: number }
  /** The consolidation clock deducted attention. */
  | { readonly reason: 'decay'; readonly amount: number }
  /** A self-tuning pass lifted a drained concept off the floor. */
  | { readonly reason: 'self-tune'; readonly amount: number; readonly cap?: number }
  /** A merge kept the strongest of the merged priorities. */
  | { readonly reason: 'merge'; readonly value: number };

/** What admitting a task is worth in attention, absent any other signal. */
const INPUT_BOOST = 0.1;

/**
 * Tolerance for "is this the *same* truth?", as opposed to "is this the same
 * belief to within a rounding step". Three orders of magnitude tighter than
 * {@link TruthOps.equals}'s default, because the question is whether re-input
 * carries any new evidence at all.
 */
const TRUTH_IDENTITY_EPSILON = 1e-9;

export type RevisionCallback = (entry: {
  termKey: string;
  truth: BeliefTruth;
  stampId: string;
  timestamp: number;
  source: 'input' | 'revision';
}) => void;

export interface ConceptConfig {
  maxBeliefs?: number;
  maxGoals?: number;
  maxQuestions?: number;
  onRevision?: RevisionCallback;
  /** The validated `strategies.bag` slot: implementation plus decay knobs. */
  bag?: ResolvedBagSlot;
}

export interface TaskData {
  id: string;
  priority: number;
  readonly term: Term;
  readonly truth?: Truth;
  readonly budget: Budget;
  readonly timestamp?: number;
  /** Minted at admission when the caller had none, so a read never has to invent one. */
  readonly stamp: Stamp;
  readonly occurrenceTime?: number;
  readonly derived?: boolean;
}

export type ConceptTaskType = TaskType;

export interface ConceptMergeResult {
  merged: Concept;
  discarded: Concept[];
}

export class Concept {
  readonly term: Term;
  readonly beliefBag: Bag<TaskData>;
  readonly goalBag: Bag<TaskData>;
  readonly questionBag: Bag<TaskData>;
  readonly createdAt: number;
  lastAccessedAt: number;
  private readonly onRevision?: RevisionCallback;

  constructor(term: Term, config: ConceptConfig = {}) {
    this.term = term;
    const baseOptions: BagOptions = {
      capacity: 100,
      ...config.bag,
    };
    this.beliefBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxBeliefs ?? 100 });
    this.goalBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxGoals ?? 50 });
    this.questionBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxQuestions ?? 20 });
    this.createdAt = Date.now();
    this.lastAccessedAt = Date.now();
    this.onRevision = config.onRevision;
  }

  private _priority = 0;

  /** Read-only: {@link writeAttention} is the only way in. */
  get priority(): number {
    return this._priority;
  }

  /**
   * The single write path for {@link priority}. Each arm is one named operation
   * with one reason type, so a caller cannot move attention without saying why
   * — and `attention:write-surface` can enumerate the reasons rather than grep
   * for assignments that may rot (TODO29.a §5.4).
   */
  writeAttention(event: AttentionEvent): void {
    switch (event.reason) {
      case 'input':
        this._priority = clamp01(this._priority + INPUT_BOOST);
        return;
      case 'prime':
      case 'related':
      case 'self-tune':
        this._priority = Math.min(event.cap ?? 1, clamp01(this._priority + event.amount));
        return;
      case 'decay':
        this._priority = Math.max(0, this._priority - event.amount);
        return;
      case 'assign':
      case 'merge':
        this._priority = clamp01(event.value);
    }
  }

  get key(): Term {
    return this.term;
  }

  get totalTasks(): number {
    return this.beliefBag.size() + this.goalBag.size() + this.questionBag.size();
  }

  addTask(
    type: ConceptTaskType,
    data: Omit<TaskData, 'id' | 'priority' | 'stamp'> & { readonly stamp?: Stamp }
  ): boolean {
    const stamped = { ...data, stamp: data.stamp ?? Stamp.createInput() };
    if (type === 'belief') return this.addBeliefWithRevision(stamped as TaskData);

    const bag = type === 'goal' ? this.goalBag : this.questionBag;
    const item = { ...stamped, id: makeId(), priority: data.budget.priority } as TaskData;
    const added = bag.add(item);
    added && this.recordAccess();
    return added;
  }

  hasMatchingBelief(term: Term): boolean {
    return this.findMatchingBelief(term) !== undefined;
  }

  getBeliefs(): TaskData[] {
    return this.beliefBag.toArray();
  }

  getGoals(): TaskData[] {
    return this.goalBag.toArray();
  }

  getQuestions(): TaskData[] {
    return this.questionBag.toArray();
  }

  canMergeWith(other: Concept, threshold = 0.85): boolean {
    return (
      this !== other &&
      (calculateSimilarity(this.term, other.term) >= threshold ||
        this.calculateTaskOverlap(other) >= threshold)
    );
  }

  mergeWith(others: Concept[]): ConceptMergeResult {
    for (const other of [this, ...others]) {
      other.beliefBag.forEach((belief) => {
        this.beliefBag.add(belief);
      });
      other.goalBag.forEach((goal) => {
        this.goalBag.add(goal);
      });
      other.questionBag.forEach((question) => {
        this.questionBag.add(question);
      });
    }

    this.writeAttention({
      reason: 'merge',
      value: Math.max(this.priority, ...others.map((c) => c.priority)),
    });
    return { merged: this, discarded: others };
  }

  private recordAccess(): void {
    this.lastAccessedAt = Date.now();
    this.writeAttention({ reason: 'input' });
  }

  private addBeliefWithRevision(
    data: TaskData,
    independence: IndependenceStatus = 'unknown'
  ): boolean {
    const existing = this.findMatchingBelief(data.term);

    if (existing) {
      if (!data.truth || !existing.truth) return false;

      // Evidence laundering guard: identical re-input cannot inflate confidence —
      // only independent evidence (differing truth) earns a revision. The
      // tolerance is far tighter than the algebra's, because this compares
      // re-input of one belief rather than two derivations of it.
      if (TruthOps.equals(data.truth, existing.truth, TRUTH_IDENTITY_EPSILON)) {
        this.recordAccess();
        return true;
      }

      const revisedTruth = TruthOps.revision(data.truth, existing.truth);
      this.beliefBag.remove(existing);
      const item = {
        ...data,
        id: existing.id,
        priority: data.budget?.priority ?? existing.priority,
        truth: revisedTruth,
        timestamp: Date.now(),
      } as TaskData;
      const added = this.beliefBag.add(item);
      if (added && this.onRevision && existing.stamp) {
        this.onRevision({
          termKey: termKey(this.term),
          truth: asBeliefTruth(revisedTruth),
          stampId: existing.stamp.id,
          timestamp: Date.now(),
          source: 'revision',
        });
      }
      added && this.recordAccess();
      return added;
    }

    const item = {
      ...data,
      id: makeId(),
      priority: data.budget?.priority ?? 0.5,
    } as TaskData;
    const added = this.beliefBag.add(item);
    if (added && this.onRevision && data.truth && data.stamp) {
      this.onRevision({
        termKey: termKey(this.term),
        truth: asBeliefTruth(data.truth),
        stampId: data.stamp.id,
        timestamp: Date.now(),
        source: 'input',
      });
    }
    added && this.recordAccess();
    return added;
  }

  private findMatchingBelief(term: Term): TaskData | undefined {
    return this.beliefBag.find((item) => termsEqual(item.term, term));
  }

  private calculateTaskOverlap(other: Concept): number {
    const thisSet = new TermSet();
    const otherSet = new TermSet();
    this.beliefBag.forEach((b) => {
      thisSet.add(b.term);
    });
    other.beliefBag.forEach((b) => {
      otherSet.add(b.term);
    });
    return jaccard(thisSet, otherSet);
  }
}

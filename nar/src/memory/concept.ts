import {
  asBeliefTruth,
  type BeliefTruth,
  clamp01,
  type Clock,
  makeId,
  maxScore,
  systemClock,
} from '@senars/util';
import { type Bag, type BagOptions, createBag } from '../bag/index.js';
import type { ResolvedBagSlot } from '../bag/registration.js';
import type { Term, Truth } from '../terms';
import { calculateSimilarity, Stamp, TermMap, TermSet, termKey, Truth as TruthOps } from '../terms';
import { type IndependenceStatus } from '../terms/impls/Truth.js';
import {
  type Budget,
  createBeliefTask,
  createTask,
  createTaskWeight,
  type Task,
  type TaskType,
  type Timestamp,
} from '../types';
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

/** A belief that is known to carry a truth — what {@link Concept.topBelief} returns. */
export type TopBelief = Omit<TaskData, 'truth'> & { readonly truth: Truth };

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
  /** The validated `strategies.bag` slot: the decay knobs plus the memory's stream. */
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

/**
 * A `Task` read back out of a bag entry — the read side of
 * {@link Concept.addTask}, and the only place a `TaskData` becomes a `Task`.
 *
 * Three readers rebuilt the eight fields themselves, each re-deciding the three
 * defaults a bag item does not carry: truth to `NEUTRAL`, budget to the
 * concept's priority weight, and the occurrence to *now*. The last one was a
 * clock read per task per concept on `getBeliefs()` and `getGoals()` — every
 * cycle, over the whole store — because `item.occurrenceTime || Date.now()`
 * evaluates the right side whether or not the left side answers. Leaving the
 * field absent instead lets `createTask` charge the clock only for the entries
 * that genuinely need a timestamp.
 *
 * Two of the three also spelled the fallback `||` where the third spelled it
 * `??`, so an `occurrenceTime` of `0` meant "now" to one reader and "then" to
 * another; and one of them restated {@link TaskData} as a local interface so it
 * could cast away the types it was reading.
 */
export const taskFromBagItem = (item: TaskData, type: TaskType, conceptPriority: number): Task =>
  createTask(
    item.term,
    type,
    item.truth ?? TruthOps.NEUTRAL,
    item.budget ?? createTaskWeight(conceptPriority),
    {
      stamp: item.stamp,
      occurrenceTime: item.occurrenceTime as Timestamp | undefined,
      derived: item.derived ?? false,
    }
  );

export class Concept {
  readonly term: Term;
  readonly beliefBag: Bag<TaskData>;
  readonly goalBag: Bag<TaskData>;
  readonly questionBag: Bag<TaskData>;
  readonly createdAt: number;
  lastAccessedAt: number;
  private readonly onRevision?: RevisionCallback;

  /**
   * The store's own clock, taken from the bag slot it was built with.
   *
   * A concept stamped itself with `Date.now()` directly, so its `createdAt` and
   * `lastAccessedAt` were the only two retention facts the pressure/forgetting
   * policies read that no test could pin — `consolidation.evictionOrder` ranks on
   * `lastAccessedAt` and documents itself as "a difference between two stamps
   * from the same store's own clock", which was a claim the clock did not honour.
   * The bag slot already carries a `Clock`, so nothing new is threaded.
   */
  private readonly now: Clock;

  constructor(term: Term, config: ConceptConfig = {}) {
    this.term = term;
    const baseOptions: BagOptions = {
      capacity: 100,
      ...config.bag,
    };
    this.beliefBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxBeliefs ?? 100 });
    this.goalBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxGoals ?? 50 });
    this.questionBag = createBag<TaskData>({ ...baseOptions, capacity: config.maxQuestions ?? 20 });
    this.now = config.bag?.clock ?? systemClock;
    this.createdAt = this.now();
    this.lastAccessedAt = this.createdAt;
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

  /**
   * The strongest belief this concept holds, or `undefined` when it holds none.
   *
   * The one reader of `beliefBag.peek()`, because "what does this concept
   * believe" is a question about the concept and not about its bag: twelve
   * callers were each opening the bag, taking the top item and re-checking that
   * it carried a truth — three vocabularies for the word "belief", one of them a
   * structural type that let any object with a `peek` stand in for a concept.
   *
   * The narrowing is here, once, rather than as a non-null assertion at each of
   * those callers: `truth` is what makes an item a belief, and a caller that had
   * to re-test it was reading the wrong side of the bag.
   */
  topBelief(): TopBelief | undefined {
    const top = this.beliefBag.peek();
    return top?.truth ? (top as TopBelief) : undefined;
  }

  /** This concept's strongest belief as a premise task, or `null` when it holds none. */
  beliefTask(): Task | null {
    const belief = this.topBelief();
    return belief ? createBeliefTask(this.term, belief.truth, this.priority, belief.stamp) : null;
  }

  get totalTasks(): number {
    return this.beliefBag.size() + this.goalBag.size() + this.questionBag.size();
  }

  addTask(
    type: ConceptTaskType,
    data: Omit<TaskData, 'id' | 'priority' | 'stamp'> & { readonly stamp?: Stamp }
  ): boolean {
    // Only copied when the caller arrived unstamped. `Memory.addTask` always
    // stamps, so the common admission was spreading seven fields into an object
    // that is itself spread again into the bag item and never retained.
    const stamped = data.stamp !== undefined ? data : { ...data, stamp: Stamp.createInput() };
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

  /**
   * The bag that holds `type`, or `undefined` for a task kind with no bag of its
   * own (`command`). One place that answers it: the two readers that had to
   * dispatch on the kind spelled it as a nested ternary, and the third — a
   * store walk that dispatches on every kind of every concept — was a chain long
   * enough to need its own comment.
   */
  bag(type: TaskType): Bag<TaskData> | undefined {
    return type === 'belief'
      ? this.beliefBag
      : type === 'goal'
        ? this.goalBag
        : type === 'question'
          ? this.questionBag
          : undefined;
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
      value: maxScore(others, (c) => c.priority, this.priority),
    });
    return { merged: this, discarded: others };
  }

  private recordAccess(): void {
    this.lastAccessedAt = this.now();
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
        timestamp: this.now(),
      } as TaskData;
      const added = this.beliefBag.add(item);
      if (added && this.onRevision && existing.stamp) {
        this.onRevision({
          termKey: termKey(this.term),
          truth: asBeliefTruth(revisedTruth),
          stampId: existing.stamp.id,
          timestamp: this.now(),
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
        timestamp: this.now(),
        source: 'input',
      });
    }
    added && this.recordAccess();
    return added;
  }

  /**
   * The belief about `term`, if this concept holds one.
   *
   * Keyed rather than walked: `termKey` is memoised per interned term, so this
   * is a string compare per belief instead of a recursive descent — and it runs
   * on every belief admission, for every input and every derived task.
   */
  private findMatchingBelief(term: Term): TaskData | undefined {
    const key = termKey(term);
    return this.beliefBag.find((item) => termKey(item.term) === key);
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

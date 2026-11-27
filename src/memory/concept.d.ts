import type { BeliefTruth } from '@senars/types/truth';
import { type Bag } from '../bag/index';
import type { ResolvedBagSlot } from '../bag/registration';
import type { Term, Truth } from '../terms';
import { Stamp } from '../terms';
import { type IndependenceStatus } from '../terms/impls/Truth';
import { type Budget, type Task, type TaskType } from '../types';
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
{
    readonly reason: 'input';
}
/**
 * An absolute value, written verbatim: a deserialised dump, a replayed
 * activation event, or a sensor that computed a priority of its own. The
 * shared shape is that the writer already decided the value and attention is
 * not a factor in it.
 */
 | {
    readonly reason: 'assign';
    readonly value: number;
}
/** The attention slot primed this concept itself. */
 | {
    readonly reason: 'prime';
    readonly amount: number;
    readonly cap?: number;
}
/** A neighbour of this concept was primed, and the activation spread. */
 | {
    readonly reason: 'related';
    readonly amount: number;
    readonly cap?: number;
}
/** The consolidation clock deducted attention. */
 | {
    readonly reason: 'decay';
    readonly amount: number;
}
/** A self-tuning pass lifted a drained concept off the floor. */
 | {
    readonly reason: 'self-tune';
    readonly amount: number;
    readonly cap?: number;
}
/** A merge kept the strongest of the merged priorities. */
 | {
    readonly reason: 'merge';
    readonly value: number;
};
/** A belief that is known to carry a truth — what {@link Concept.topBelief} returns. */
export type TopBelief = Omit<TaskData, 'truth'> & {
    readonly truth: Truth;
};
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
export declare const taskFromBagItem: (item: TaskData, type: TaskType, conceptPriority: number) => Task;
export declare class Concept {
    readonly term: Term;
    readonly beliefBag: Bag<TaskData>;
    readonly goalBag: Bag<TaskData>;
    readonly questionBag: Bag<TaskData>;
    readonly createdAt: number;
    lastAccessedAt: number;
    private readonly onRevision?;
    /** Term-keyed index for O(1) belief lookup. Maps termKey -> belief item. */
    private readonly beliefIndex;
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
    private readonly now;
    constructor(term: Term, config?: ConceptConfig);
    private _priority;
    /** Read-only: {@link writeAttention} is the only way in. */
    get priority(): number;
    /**
     * The single write path for {@link priority}. Each arm is one named operation
     * with one reason type, so a caller cannot move attention without saying why
     * — and `attention:write-surface` can enumerate the reasons rather than grep
     * for assignments that may rot (TODO29.a §5.4).
     */
    writeAttention(event: AttentionEvent): void;
    get key(): Term;
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
    topBelief(): TopBelief | undefined;
    /** This concept's strongest belief as a premise task, or `null` when it holds none. */
    beliefTask(): Task | null;
    get totalTasks(): number;
    addTask(type: ConceptTaskType, data: Omit<TaskData, 'id' | 'priority' | 'stamp'> & {
        readonly stamp?: Stamp;
    }): boolean;
    hasMatchingBelief(term: Term): boolean;
    /** Remove a belief by id, updating the term-keyed index. */
    removeBelief(id: string): boolean;
    getBeliefs(): TaskData[];
    getGoals(): TaskData[];
    getQuestions(): TaskData[];
    /**
     * The bag that holds `type`, or `undefined` for a task kind with no bag of its
     * own (`command`). One place that answers it: the two readers that had to
     * dispatch on the kind spelled it as a nested ternary, and the third — a
     * store walk that dispatches on every kind of every concept — was a chain long
     * enough to need its own comment.
     */
    bag(type: TaskType): Bag<TaskData> | undefined;
    canMergeWith(other: Concept, threshold?: number): boolean;
    mergeWith(others: Concept[]): ConceptMergeResult;
    private recordAccess;
    private addBeliefWithRevision;
    /**
     * The belief about `term`, if this concept holds one.
     *
     * O(1) lookup via term-keyed index.
     */
    private findMatchingBelief;
    private calculateTaskOverlap;
}
//# sourceMappingURL=concept.d.ts.map
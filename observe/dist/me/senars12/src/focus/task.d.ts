/**
 * The focus task vocabulary, and the one projection into it.
 *
 * Game perceptions, reflex proposals and outcomes all arrive as *records* and
 * leave as `FocusTask[]` in the focus's bag. That is a projection, not a gate:
 * nothing here refuses anything, so naming it after the kernel gates
 * (`KernelPerceptionGate` and friends, which do refuse) claimed an authority
 * these functions never had. One module holds the factory, the term builders
 * and all three projections so the vocabulary has a single home.
 */
import type { TaskBagKind } from '@senars/schemas';
import { type Clock } from '@senars/util/clock';
import type { BagItem } from '@senars/bag';
import type { GameOutcome, Perception } from '../game/Game';
import { type ActionProposal } from '../reflex/Reflex';
import type { Term } from '../terms';
import type { Budget } from '../types/index';
import type { TermTruth } from '../types/truth';
export interface FocusTask extends BagItem {
    term: Term;
    type: TaskBagKind;
    truth: TermTruth;
    budget: Budget;
    stamp: string;
    derived: boolean;
}
export interface FocusConcept extends BagItem {
    term: Term;
    /** Truth of the belief that created the concept (drives NAL derivation truth). */
    truth?: TermTruth;
    activation: number;
    totalTasks: number;
}
interface TaskSpec {
    id: string;
    term: Term;
    type: FocusTask['type'];
    priority: number;
    /** Budget priority; defaults to `priority` when a task's budget diverges from its bag priority. */
    budgetPriority?: number;
    f: number;
    c: number;
    stamp: string;
}
export declare const focusTask: ({ id, term, type, priority, budgetPriority, f, c, stamp, }: TaskSpec) => FocusTask;
/** `snake` — the game state as a plain belief. */
export declare const stateTerm: (stateId: string) => Term;
/** `[score_3]` — a named feature observed at a value. */
export declare const featureTerm: (feature: string, value: number) => Term;
/** `[reward_positive]` — the sign of an outcome. */
export declare const rewardTerm: (reward: number) => Term;
/** `move(left --> right)` — a reflex proposal as an executable operation term. */
export declare const actionTerm: (action: string, args: Readonly<Record<string, unknown>>) => Term;
/** A game observation as the state belief plus one belief per numeric feature. */
export declare const perceptionTasks: (perception: Perception, clock?: Clock) => FocusTask[];
/** An outcome as a reward-sign belief, plus a terminal flag when the episode ended. */
export declare const outcomeTasks: (outcome: GameOutcome, clock?: Clock) => FocusTask[];
/** Reflex proposals as executable goals, weighted by {@link expectedValue}. */
export declare const proposalTasks: (proposals: readonly ActionProposal[], clock?: Clock) => FocusTask[];
export {};
//# sourceMappingURL=task.d.ts.map
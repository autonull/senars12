import type { Perception } from '../game/Game';
import type { JudgmentProvenance } from '../lm/system-one/decide';
export interface ActionProposal {
    action: string;
    args?: Record<string, unknown>;
    value: number;
    confidence: number;
    source: string;
    /** Optional provenance for cascade judgments (auditability). */
    provenance?: JudgmentProvenance;
}
/**
 * The one reflex salience: `value × confidence` — the product the quorum
 * accumulates, the focus projects onto priority, and {@link byExpectedValue}
 * ranks by. Spelled inline at six sites, any of which could disagree.
 */
export declare const expectedValue: ({ value, confidence }: ActionProposal) => number;
/** The one reflex ranking order: highest {@link expectedValue} first. */
export declare const byExpectedValue: (a: ActionProposal, b: ActionProposal) => number;
export interface LearningEvent {
    perception: Perception;
    previousPerception: Perception | null;
    actionProposed: string;
    actionExecuted: string | null;
    reward: number;
    terminal: boolean;
    overriddenBy: string | null;
}
export interface Reflex<S = unknown, A = unknown> {
    readonly id: string;
    propose(state: S, legalActions: A[]): ActionProposal[];
    learn(event: LearningEvent): void;
}
//# sourceMappingURL=Reflex.d.ts.map
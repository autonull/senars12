import type { Focus, FocusTask } from './Focus';
import type { TermTruth } from '../types/truth';
export interface SeededBelief {
    /** Narsese, e.g. `(up ==> wall_bump)`. The antecedent atom names the action. */
    narsese: string;
    truth: TermTruth;
    priority?: number;
}
/** Inject a Narsese rule belief into the focus's task bag (E7 Self-Concept-Vocabulary pattern). */
export declare function seedBelief(focus: Focus, belief: SeededBelief): FocusTask | null;
/** Seed a per-action rule of the form `(<action> ==> <consequence>)`. */
export declare const actionRuleBelief: (action: string, consequence: string, truth: TermTruth, priority?: number) => SeededBelief;
//# sourceMappingURL=belief-seeding.d.ts.map
import type { Task } from '../types';
import type { Concept } from './concept';
export interface FocusConfig {
    maxConcepts: number;
}
/**
 * The concepts attention is currently spent on, bounded by priority.
 *
 * It stores the concepts and nothing else. It used to store a `priority` copy
 * taken at insert time and let `adjustAttention` move that copy, which made a
 * second owner of a quantity `Concept` already owns — one that drifted the
 * moment anything was primed, decayed or restored. Focus *selects* by
 * priority; it does not keep it (TODO29.a §5.4).
 */
export declare class Focus {
    private concepts;
    private config;
    /** The goals attention is steered by, empty until a caller sets them. Read through
     *  {@link Focus.getActiveGoals}, which is the only accessor: the topic-boost and
     *  priority-adjust path this pair served had no caller left, so both fields spent a
     *  turn copying an array nobody read. */
    private activeGoals;
    constructor(config?: FocusConfig);
    get size(): number;
    get capacity(): number;
    addToFocus(concept: Concept): void;
    removeFromFocus(concept: Concept): boolean;
    forEachFocus(fn: (concept: Concept) => void): void;
    focusConcepts(): IterableIterator<Concept>;
    getFocusSet(): Concept[];
    clearFocus(): void;
    /** The goals attention is steered by; the same array, not a copy per read. */
    getActiveGoals(): readonly Task[];
    setActiveGoals(goals: readonly Task[]): void;
}
//# sourceMappingURL=focus.d.ts.map
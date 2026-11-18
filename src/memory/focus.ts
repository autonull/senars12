import { type Term, TermMap } from '../terms';
import type { Task } from '../types';
import type { Concept } from './concept.js';

export interface FocusConfig {
  maxConcepts: number;
}

const DEFAULT_CONFIG: FocusConfig = {
  maxConcepts: 50,
};

/**
 * The concepts attention is currently spent on, bounded by priority.
 *
 * It stores the concepts and nothing else. It used to store a `priority` copy
 * taken at insert time and let `adjustAttention` move that copy, which made a
 * second owner of a quantity `Concept` already owns — one that drifted the
 * moment anything was primed, decayed or restored. Focus *selects* by
 * priority; it does not keep it (TODO29.a §5.4).
 */
export class Focus {
  private concepts: TermMap<Concept> = new TermMap();
  private config: FocusConfig;
  /** The goals attention is steered by, empty until a caller sets them. Read through
   *  {@link Focus.getActiveGoals}, which is the only accessor: the topic-boost and
   *  priority-adjust path this pair served had no caller left, so both fields spent a
   *  turn copying an array nobody read. */
  private activeGoals: readonly Task[] = [];

  constructor(config: FocusConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  get size(): number {
    return this.concepts.size;
  }

  get capacity(): number {
    return this.config.maxConcepts;
  }

  addToFocus(concept: Concept): void {
    if (this.concepts.size >= this.config.maxConcepts && !this.concepts.has(concept.term)) {
      // Scanned, not materialised: past the cap every admission was allocating a
      // `maxConcepts`-sized entry array to read one minimum from. Ties keep the
      // first, as `minBy` did.
      let lowest: Concept | undefined;
      for (const candidate of this.concepts.values()) {
        if (lowest === undefined || candidate.priority < lowest.priority) lowest = candidate;
      }
      if (!lowest || lowest.priority >= concept.priority) return;
      this.concepts.delete(lowest.term);
    }
    this.concepts.set(concept.term, concept);
  }

  removeFromFocus(concept: Concept): boolean {
    return this.concepts.delete(concept.term);
  }

  forEachFocus(fn: (concept: Concept) => void): void {
    for (const concept of this.concepts.values()) {
      fn(concept);
    }
  }

  *focusConcepts(): IterableIterator<Concept> {
    yield* this.concepts.values();
  }

  getFocusSet(): Concept[] {
    const out: Concept[] = [];
    this.forEachFocus((c) => out.push(c));
    return out;
  }

  clearFocus(): void {
    this.concepts.clear();
  }

  /** The goals attention is steered by; the same array, not a copy per read. */
  getActiveGoals(): readonly Task[] {
    return this.activeGoals;
  }

  setActiveGoals(goals: readonly Task[]): void {
    this.activeGoals = goals;
  }
}

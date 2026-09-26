/**
 * Kernel Contracts — TermView
 * Read-only view of a term with its associated truth value (from a belief/task).
 * Breaks cycles: reason/strategy.ts → ../memory, ../rules
 */
import type { Term } from '@senars/nar/terms';
import type { Truth } from '@senars/nar/terms/truth';

export interface TermView {
  readonly term: Term;
  readonly truth: Truth;
  readonly priority: number;
  readonly stamp: {
    readonly id: string;
    readonly creationTime: number;
    readonly derivations: readonly string[];
  } | null;
}

export function createTermView(
  term: Term,
  truth: Truth,
  priority: number,
  stamp?: TermView['stamp']
): TermView {
  return Object.freeze({
    term,
    truth,
    priority,
    stamp: stamp ?? null,
  });
}

/**
 * Creates a TermView from a concept's best belief.
 */
export function termViewFromConcept(
  concept: { readonly term: Term; readonly priority: number; readonly beliefBag: { peek(): { truth?: Truth; stamp?: { id: string; creationTime: number; derivations: readonly string[] } } | null } }
): TermView | null {
  const belief = concept.beliefBag.peek();
  if (!belief?.truth) return null;
  return createTermView(
    concept.term,
    belief.truth,
    concept.priority,
    belief.stamp ? { id: belief.stamp.id, creationTime: belief.stamp.creationTime, derivations: belief.stamp.derivations ?? [] } : null
  );
}
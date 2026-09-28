import type { Term, Truth as TruthType } from '../terms';
import { containsSubterm, getSubject, TermSet, Truth } from '../terms';
import type { Task } from '../types';

/**
 * Minimal engine surface a counterfactual probe needs. Declared structurally so
 * the reason layer never depends on the NAR facade.
 */
export interface CounterfactualHost {
  getBeliefs(): Task[];
  believe(term: Term, truth: TruthType): Promise<void>;
  run(steps?: number): Promise<void>;
}

export interface CounterfactualReport {
  possible: boolean;
  original?: string;
  whatWouldChange: string[];
  dependentBeliefs: string[];
  reason?: string;
}

export async function counterfactual(
  term: Term,
  negate: boolean,
  host: CounterfactualHost,
  steps = 5
): Promise<CounterfactualReport> {
  const beliefsBefore = host.getBeliefs().map((b) => ({
    term: b.term,
    truth: b.truth ? { ...b.truth } : undefined,
  }));

  const originalBelief = beliefsBefore.find((b) => b.term === term);
  if (!originalBelief) {
    return {
      possible: false,
      whatWouldChange: [],
      dependentBeliefs: [],
      reason: 'No belief to counterfactual',
    };
  }

  const originalTruth = originalBelief.truth;
  const negatedTruth: Truth = originalTruth
    ? Truth.create(negate ? 1 - originalTruth.f : originalTruth.f, originalTruth.c * 0.5)
    : Truth.create(negate ? 0 : 1, 0.5);

  try {
    await host.believe(term, negatedTruth);
    await host.run(steps);

    const beliefsAfter = host.getBeliefs().map((b) => b.term);
    const beforeSet = new TermSet();
    for (const b of beliefsBefore) beforeSet.add(b.term);

    const changed = beliefsAfter.filter((b) => !beforeSet.has(b));
    const subject = getSubject(term);
    const dependent = subject
      ? beliefsAfter.filter((b) => containsSubterm(b, subject))
      : beliefsAfter;

    return {
      possible: true,
      original: originalBelief.term.toString(),
      whatWouldChange: changed.slice(0, 10).map((t) => t.toString()),
      dependentBeliefs: dependent.slice(0, 5).map((t) => t.toString()),
    };
  } finally {
    if (originalTruth) {
      await host.believe(term, originalTruth);
    }
  }
}

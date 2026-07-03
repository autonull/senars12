import type { NAR } from '../nar.js';
import type { Term } from '../terms';
import { TermSet, Truth, containsSubterm, getSubject } from '../terms';

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
  nar: NAR,
  steps = 5
): Promise<CounterfactualReport> {
  const beliefsBefore = nar.getBeliefs().map((b) => ({
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
    await nar.believe(term, negatedTruth);
    await nar.run(steps);

    const beliefsAfter = nar.getBeliefs().map((b) => b.term);
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
      await nar.believe(term, originalTruth);
    }
  }
}

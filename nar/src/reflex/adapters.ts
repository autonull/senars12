import type { ActionProposal, LearningEvent, Reflex } from './Reflex.js';

/**
 * TODO19 F6: composable ReflexAdapter wrappers. One wrapper chain API replaces
 * per-script plumbing (the arcade's RecordingReflex + prefetch forwarding).
 * Wrappers never alter a reflex's decision logic — only observation, recording,
 * and proposal ordering (veto demotion, L1).
 */

export type AdapterReflex = Reflex & {
  prefetch?: (...args: unknown[]) => unknown;
  getLastProposals?: () => ActionProposal[];
};
export type ReflexWrapper = (inner: Reflex) => AdapterReflex;

/** Duck-typed prefetch carrier (GameFocus's ReflexPrefetchContext consumer). */
export interface PrefetchingReflex extends Reflex {
  prefetch?(context: unknown): void;
}

const duckPrefetch = (reflex: Reflex, args: unknown[]): void => {
  const p = (reflex as PrefetchingReflex).prefetch;
  if (typeof p === 'function') (p as (...a: unknown[]) => unknown).apply(reflex, args);
};

/** Forwards `prefetch` (all arguments) to the wrapped reflex. */
export const forwardingReflex =
  (): ReflexWrapper =>
  (inner: Reflex): AdapterReflex => ({
    id: inner.id,
    propose: (state, legal) => inner.propose(state, legal),
    learn: (e) => inner.learn(e),
    prefetch: (...args: unknown[]) => duckPrefetch(inner, args),
  });

/** Records the top proposals of each `propose` call for external inspection. */
export const recordingReflex = (): ReflexWrapper => {
  let lastProposals: ActionProposal[] = [];
  return (inner: Reflex): AdapterReflex => ({
    id: inner.id,
    propose: (state, legal) => {
      lastProposals = inner.propose(state, legal);
      return lastProposals;
    },
    learn: (e) => inner.learn(e),
    getLastProposals: () => [...lastProposals],
  });
};

/**
 * L1 veto-aware demotion: actions whose LearningEvent carries `overriddenBy`
 * are demoted in proposal ordering (scored down, order preserved). Falsifies
 * as: veto rate drops across episodes while return holds.
 */
export const vetoAwareReflex =
  (demotion = 0.5): ReflexWrapper =>
  (inner: Reflex): AdapterReflex => {
    const overridden = new Map<string, number>();
    return {
      id: inner.id,
      propose: (state, legal) => {
        const proposals = inner.propose(state, legal);
        return proposals
          .map((p) =>
            overridden.has(String(p.action))
              ? { ...p, value: p.value * demotion, confidence: p.confidence * demotion }
              : p
          )
          .sort((a, b) => b.value * b.confidence - a.value * a.confidence);
      },
      learn: (e: LearningEvent) => {
        if (e.overriddenBy && e.actionProposed)
          overridden.set(e.actionProposed, (overridden.get(e.actionProposed) ?? 0) + 1);
        inner.learn(e);
      },
    };
  };

/** Compose a wrapper chain around a base reflex: `wrapReflex(base, recordingReflex(), vetoAwareReflex())`. */
export const wrapReflex = (base: Reflex, ...wrappers: ReflexWrapper[]): AdapterReflex =>
  wrappers.reduceRight((acc, w) => w(acc), base);

/** Recording wrapper handle: extract `lastProposals` from a chain built with `recordingReflex()`. */
export const recordedProposals = (reflex: Reflex): ActionProposal[] =>
  (reflex as AdapterReflex).getLastProposals?.() ?? [];

/**
 * Every place the reasoning cycle can await a provider, declared as data.
 *
 * **A1 (2026-09-30): all three are bounded.** The bounds are a deadline on the
 * consumer's own await — `LMRule`'s `callTimeoutMs`, the gate's `judgeTimeoutMs`,
 * the reasoner's `backendTimeoutMs` — and each one is an off-cycle await as of
 * A1: the cycle stages model-backed work and pumps it at a boundary, so the
 * question this file answers changed from "does the cycle hang" to "does any
 * consumer hang". Both are worth knowing and only this file can say which.
 *
 * TODO29.a §1.3 states the cycle invariant as a *property* — "the synchronous
 * cycle must never depend on an external model response for completion" — and
 * §0.6 item 1 asks A0 for "provider-*dependency* detection, not presence
 * detection". Presence detection is `lm.enabled === false`, which is true on a
 * tree where `KernelPerceptionGate` still awaits a judge with no timeout
 * (§4 row 11). A declaration is the honest instrument: a seam is listed here
 * with the bound it has **today**, and `cycle:dependency` drives a
 * never-resolving provider through each one to find out whether the declaration
 * is true.
 *
 * A declaration was therefore a measurement, not an omission, and A1 made the
 * property hold: every row is `bounded: true` with the deadline that bounds it,
 * and the gate asserts that the deadline actually interrupts a provider that
 * never answers. Nothing here decides what a bound should be — that is A7's
 * budget scopes and A3's protocol — only whether one exists.
 */

/** A cycle-path await on something outside the process's own computation. */
export interface ProviderSeam {
  readonly id: string;
  /** What the consumer calls, in the consumer's own terms. */
  readonly call: string;
  /** Where the await happens, and the text that must still be on that line. */
  readonly callSites: readonly { readonly ref: string; readonly contains: string }[];
  /** Whether a cycle reaches this await. */
  readonly onCyclePath: boolean;
  /**
   * Whether the await is bounded today — a timeout, a budget, or an abort
   * signal that the cycle is guaranteed to raise. `false` means a provider that
   * never resolves hangs the caller forever.
   */
  readonly bounded: boolean;
  /** The bound, when there is one. Required whenever `bounded`. */
  readonly bound?: string;
  /** The inventory behaviour this seam performs, by id. */
  readonly behaviour: string;
}

export const PROVIDER_SEAMS: readonly ProviderSeam[] = [
  {
    id: 'lm-rule-apply',
    call: 'LMRule.apply',
    callSites: [{ ref: 'nar/src/lm/rule/LMRule.ts:416', contains: 'await withTimeout(' }],
    onCyclePath: false,
    bounded: true,
    bound: 'LMRule.callTimeoutMs — the deadline on one provider call, default 8s',
    behaviour: 'lm-rule-derivation',
  },
  {
    id: 'ingress-judge',
    call: 'IngressJudge.judge',
    callSites: [
      { ref: 'nar/src/kernel/KernelPerceptionGate.ts:193', contains: 'await raceDeadline(' },
    ],
    onCyclePath: true,
    bounded: true,
    bound:
      'KernelPerceptionGate systemOne.judgeTimeoutMs — the deadline on one judgment, default 2s',
    behaviour: 'ingress-judgment',
  },
  {
    id: 'stream-reasoner-backend',
    call: 'LMBackend',
    callSites: [{ ref: 'nar/src/stream/reasoner.ts:147', contains: 'await raceDeadline(' }],
    onCyclePath: false,
    bounded: true,
    bound: 'StreamReasoner.backendTimeoutMs — the deadline on one flush, default 8s',
    behaviour: 'stream-reasoner-flush',
  },
];

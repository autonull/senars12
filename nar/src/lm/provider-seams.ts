/**
 * Every place the reasoning cycle can await a provider, declared as data.
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
 * `bounded: false` is therefore a measurement, not an omission. A1 turns these
 * rows to `true` by making the property hold; the gate then asserts it. Nothing
 * here decides what a bound should be — that is A7's budget scopes and A3's
 * protocol — only whether one exists.
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
    callSites: [{ ref: 'nar/src/rules/impls/processor.ts:404', contains: 'await lmRule.apply(' }],
    onCyclePath: true,
    bounded: false,
    behaviour: 'lm-rule-derivation',
  },
  {
    id: 'ingress-judge',
    call: 'IngressJudge.judge',
    callSites: [
      { ref: 'nar/src/kernel/KernelPerceptionGate.ts:154', contains: 'await this.judge!.judge(' },
    ],
    onCyclePath: true,
    bounded: false,
    behaviour: 'ingress-judgment',
  },
  {
    id: 'stream-reasoner-backend',
    call: 'LMBackend',
    callSites: [{ ref: 'nar/src/stream/reasoner.ts:87', contains: 'await backend(batch)' }],
    onCyclePath: false,
    bounded: false,
    behaviour: 'stream-reasoner-flush',
  },
];

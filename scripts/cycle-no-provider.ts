#!/usr/bin/env tsx

/**
 * `cycle:no-provider` — provider-*dependency* detection (TODO29.a §0.6 item 1).
 *
 * Not presence detection. `lm.enabled === false` is true on a tree where
 * `KernelPerceptionGate` still awaits a judge with no timeout (§4 row 11), which
 * is why every wording of "no model in the cycle" is a proxy and §4 row 5 shows
 * one passing while a real dependency remained. This gate drives a
 * **never-resolving provider** into every declared seam and asks the only
 * question that matters: does the consumer block?
 *
 * **What A0 asserts, and what A1 adds.** Today the answer is yes for all three
 * declared seams, so asserting "nothing blocks" would be a gate red on arrival.
 * What A0 asserts is that the declarations are *true* — the symmetric rule is
 * in `scripts/lib/provider-dependency.ts` — so a seam cannot be marked bounded
 * without a bound appearing behind it. A1 makes the bound real and this same
 * gate becomes the invariant: a cycle completes with `J` and `P` backends that
 * never resolve. Only three booleans change between those two states.
 *
 * Each probe drives the real object, not a test double for it: the real
 * `LMRule` over a real `LMService` whose `tryGenerateText` never settles, the
 * real `KernelPerceptionGate` over the real `IngressJudge` interface, the real
 * `StreamReasoner`. A probe of a fake seam proves the fake is unobservable — and
 * every probe reports whether it was *entered*, because a hook that silently
 * observes nothing produces a table of confident zeroes (§4 rows 7 and 9).
 */

import { raceDeadline } from '@senars/util';
import { createGateRegistry } from '../nar/src/kernel/GateRegistry.js';
import { KernelPerceptionGate } from '../nar/src/kernel/KernelPerceptionGate.js';
import { PROVIDER_SEAMS } from '../nar/src/lm/provider-seams.js';
import { LMRule } from '../nar/src/lm/rule/LMRule.js';
import { StreamReasoner } from '../nar/src/stream/reasoner.js';
import { TermBuilder, type Truth } from '../nar/src/terms/index.js';
import { checkSeams, type SeamProbe } from './lib/provider-dependency.js';
import { report } from './lib/verdicts.js';

/** A promise that never settles. The absence of a timeout is the thing under test. */
const NEVER = <T>(): Promise<T> => new Promise<T>(() => {});

const PROBE_TIMEOUT_MS = 250;

/** Whether `work` settles within the probe's deadline. */
const completesWithin = async (work: Promise<unknown>, ms = PROBE_TIMEOUT_MS): Promise<boolean> =>
  !(await raceDeadline(work, ms)).timedOut;

/**
 * `LMRule.apply` over a provider that never answers. The circuit breaker wraps
 * the call but bounds *failure count*, not time, so this is the shape A1's
 * timeout has to interrupt.
 */
const lmRuleApply = async (): Promise<SeamProbe> => {
  const { atom, inheritance } = TermBuilder;
  const provider = {
    count: 0,
    tryGenerateText: (): Promise<string> => (provider.count++, NEVER<string>()),
  };
  const rule = new LMRule('probe-hang', provider as never, {
    name: 'probe-hang',
    promptTemplate: 'probe',
    fallback: () => null,
    callTimeoutMs: PROBE_TIMEOUT_MS / 5,
  });
  const primary = inheritance(atom('a'), atom('b'));
  const settled = await completesWithin(rule.apply(primary, primary));
  return { id: 'lm-rule-apply', entered: provider.count > 0, blocks: !settled };
};

/** The ingress judge the gate awaits before admitting an observation. */
const ingressJudge = async (): Promise<SeamProbe> => {
  let entered = false;
  const gate = new KernelPerceptionGate({
    systemOne: {
      enabled: true,
      judge: {
        judge: () => {
          entered = true;
          return NEVER<never>();
        },
      },
      judgeTimeoutMs: PROBE_TIMEOUT_MS / 5,
    },
  });
  const settled = await completesWithin(
    gate.admit({
      rawObservation: '(a --> b)',
      sourceQuality: 0.5,
      baseConfidence: 0.5,
      taskType: 'belief',
    })
  );
  return { id: 'ingress-judge', entered, blocks: !settled };
};

/** The seam that already has the shape A1 wants, and still has no timeout. */
const streamReasonerBackend = async (): Promise<SeamProbe> => {
  let entered = false;
  const reasoner = new StreamReasoner({
    gates: createGateRegistry(),
    backendTimeoutMs: PROBE_TIMEOUT_MS / 5,
  });
  reasoner.dispatch('probe');
  const backend = () => {
    entered = true;
    return NEVER<Map<string, Truth>>();
  };
  const settled = await completesWithin(reasoner.flush(backend as never));
  return { id: 'stream-reasoner-backend', entered, blocks: !settled };
};

const PROBES: Record<string, () => Promise<SeamProbe>> = {
  'lm-rule-apply': lmRuleApply,
  'ingress-judge': ingressJudge,
  'stream-reasoner-backend': streamReasonerBackend,
};

const probes = await Promise.all(PROVIDER_SEAMS.map((seam) => PROBES[seam.id]!()));

console.log('cycle-path provider seams — a never-resolving provider at each declared seam\n');
for (const seam of PROVIDER_SEAMS) {
  const probe = probes.find((candidate) => candidate.id === seam.id);
  const verdict = !probe?.entered ? 'NOT REACHED' : probe.blocks ? 'BLOCKS   ' : 'free     ';
  console.log(
    `  ${verdict} ${seam.id.padEnd(24)} declared ${(seam.bounded ? 'bounded  ' : 'UNBOUNDED').padEnd(10)} ` +
      `(${seam.onCyclePath ? 'on' : 'off'} the cycle path)`
  );
}
console.log();

const failures = checkSeams(PROVIDER_SEAMS, probes);
report('cycle:no-provider', failures, {
  lines: ({ kind, seam, detail }) => [`${kind} — ${seam}`, `  ${detail}`],
});

console.log(
  `cycle:no-provider ok — ${probes.length} seams reached, every declaration truthful.\n` +
    '  Every declared seam interrupts a provider that never answers, and the cycle reaches\n' +
    '  none of them from inside `reason` (tests/nar/todo29a-a1.test.ts).'
);

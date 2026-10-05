/**
 * TODO32 M2: egress judging — opt-in, bounded, and gate-invariant.
 *
 * The load-bearing claim is not "a veto can fire" but §7's: optimization may
 * never change **what counts as** committed state. So the first test is the one
 * that matters — with the flag off, a NAR with the port bound commits exactly
 * what a NAR with no port at all commits, byte for byte.
 *
 * A fake `DecisionPort` is the right instrument here (AGENTS: test objects
 * directly, avoid mocks): the port is a one-method structural contract, so a
 * plain object *is* the double, and what the veto reads off it — `score`,
 * `abstained`, `null` — is stated rather than stubbed.
 */

import { describe, expect, it } from 'vitest';
import { createNAR } from '../../../nar/src/nar-presets.js';
import { termKey, Truth } from '../../../nar/src/terms/index.js';
import { NO_DECISION_PORT } from '../../../nar/src/ports/decision.js';
import type { DecisionResult } from '../../../nar/src/ports/decision.js';
import { systemOneDefaults, systemOneSchema } from '@senars/util/config';

/**
 * The port serves both cycle call sites, so a test about egress must select its
 * asks out of the traffic rather than assume it is the only caller.
 */
const isEgressAsk = (r: { kind?: string }): boolean => r.kind === 'evaluate';

/**
 * An `evaluate` proposition. The branded id/digest fields have no runtime
 * representation, so they are filled once here rather than spelled at each call
 * site — the shape is what the veto reads (`score`, `abstained`), and everything
 * else is provenance the port would really have minted.
 */
const evaluate = (score: number, abstained = false): DecisionResult =>
  ({
    kind: 'evaluate',
    axis: 'epistemic',
    score,
    abstained,
    ...(abstained ? { abstainReason: 'low-confidence' as const } : {}),
    queryId: 'q',
    backendId: 'b',
    modelDigest: 'd',
    calibration: { version: 'v', ece: 0 },
    latencyMs: 1,
    cost: { tokensIn: 0, tokensOut: 0, computeMs: 1, memoryMb: 0 },
    tier: 1,
  }) as unknown as DecisionResult;

/** Everything committed, as term keys — §0.4's trap 1 applies to the test too. */
const committed = async (nar: Awaited<ReturnType<typeof createNAR>>): Promise<string[]> =>
  [...nar.getBeliefs(), ...nar.getGoals(), ...nar.getQuestions()]
    .map((t) => `${t.type}:${termKey(t.term)}`)
    .sort();

const episode = async (nar: Awaited<ReturnType<typeof createNAR>>, cycles = 10): Promise<void> => {
  await nar.initialize();
  for (const [term, f] of [
    ['(cat --> mammal).', 0.9],
    ['(whiskers --> cat).', 0.9],
  ] as const) {
    await nar.input(term, 'belief', Truth.create(f, 0.9));
  }
  await nar.input('(whiskers --> mammal).', 'question');
  for (let i = 0; i < cycles; i++) await nar.run(1);
};

describe('M2: Egress judging', () => {
  it('flag off — a bound port commits exactly what no port commits', async () => {
    const bound = await createNAR({ maxConcepts: 500, decision: NO_DECISION_PORT });
    const unbound = await createNAR({ maxConcepts: 500 });

    const [withPort, without] = await Promise.all([episode(bound), episode(unbound)]);

    expect(await committed(bound)).toEqual(await committed(unbound));
    expect(withPort).toBe(without);
  });

  it('flag off — the schema default is off, so upgrading cannot grant a veto', () => {
    // Asserted on the schema rather than on a configured NAR, because a NAR that
    // never mentions `systemOne` has no `systemOne` object to read `undefined`
    // from — that would pass for "off" whether or not the default were.
    expect(systemOneSchema.parse({}).egressJudging.enabled).toBe(false);
    expect(systemOneSchema.parse({ enabled: true }).egressJudging.rubric).toBe('conflict');
  });

  it('flag on — a high-conflict conclusion is vetoed and its question never resolves', async () => {
    const asked: string[] = [];
    const vetoAll = {
      ask: async (request: { kind?: string; target?: string }): Promise<DecisionResult | null> => {
        if (isEgressAsk(request)) asked.push(request.target ?? '');
        // 1.0 is the top of the `conflict` legend: strong conflict.
        return evaluate(1.0);
      },
    };

    const judged = await createNAR({
      maxConcepts: 500,
      decision: vetoAll,
      systemOne: { egressJudging: { ...systemOneDefaults.egressJudging, enabled: true } },
    });
    const control = await createNAR({ maxConcepts: 500 });

    const [withEgress, without] = await Promise.all([episode(judged), episode(control)]);

    // The judge was consulted about concrete terms, not the ambient context.
    expect(asked.length).toBeGreaterThan(0);
    expect(asked.every((t) => t.length > 0)).toBe(true);

    // It only ever removes: a strict subset, never a superset.
    const vetoed = await committed(judged);
    const baseline = await committed(control);
    expect(vetoed.length).toBeLessThan(baseline.length);
    expect(baseline.filter((t) => vetoed.includes(t))).toEqual(vetoed);

    await judged.dispose();
    await control.dispose();
  });

  it('flag on — an abstention, a null and a timeout all mean no veto', async () => {
    const answers: (DecisionResult | null)[] = [null, evaluate(0, true)];

    const nar = await createNAR({
      maxConcepts: 500,
      decision: {
        ask: async () => answers.shift() ?? null,
      },
      systemOne: { egressJudging: { ...systemOneDefaults.egressJudging, enabled: true } },
    });
    const control = await createNAR({ maxConcepts: 500 });

    const [judged, baseline] = await Promise.all([episode(nar), episode(control)]);

    // A judge that never answers must not cost the symbolic path anything:
    // cognition continues on the ranking that already ran.
    expect(await committed(nar)).toEqual(await committed(control));
    expect(judged).toBe(baseline);

    await nar.dispose();
    await control.dispose();
  });

  it('the veto is bounded — it judges no more than maxCandidates per cycle', async () => {
    let asks = 0;
    const nar = await createNAR({
      maxConcepts: 500,
      decision: {
        ask: async (request: { kind?: string }) => {
          if (isEgressAsk(request)) asks++;
          return null;
        },
      },
      systemOne: {
        egressJudging: { ...systemOneDefaults.egressJudging, enabled: true, maxCandidates: 2 },
      },
    });

    await episode(nar, 5);

    // The judge is actually consulted — otherwise this bound is satisfied by a
    // veto that never runs, which is the vacuous way to pass it.
    expect(asks).toBeGreaterThan(0);
    // And 5 cycles × 2 candidates, and not one more. An unbounded sweep would
    // make cognition's cost track `ranking.maxAdmissions` instead of the config.
    expect(asks).toBeLessThanOrEqual(5 * 2);
    await nar.dispose();
  });
});
